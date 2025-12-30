const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let app;
let mongoServer;

jest.setTimeout(30000);

const registerUser = async ({ name, email, password, role }) => {
  const res = await request(app).post('/api/auth/register').send({
    name,
    email,
    password,
    role,
  });
  expect(res.status).toBe(201);
  expect(res.body.success).toBe(true);
  return res.body.data;
};

const loginUser = async ({ email, password }) => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  return res.body.data.token;
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'testsecret';
  process.env.JWT_EXPIRES_IN = '1d';
  process.env.NODE_ENV = 'test';

  // Require app after env is set so connectDB uses in-memory Mongo
  app = require('../src/app');
});

afterAll(async () => {
  await mongoose.connection.close();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  if (mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
});

// Helper to create admin and normal user, doctor, and generated slots
const setupDoctorAndSlots = async () => {
  // Create admin
  const admin = await registerUser({
    name: 'Admin',
    email: 'admin@example.com',
    password: 'Password1',
    role: 'admin',
  });
  const adminToken = await loginUser({
    email: 'admin@example.com',
    password: 'Password1',
  });

  // Create doctor user (role user is fine for underlying account)
  const doctorUser = await registerUser({
    name: 'Dr User',
    email: 'doctor@example.com',
    password: 'Password1',
    role: 'user',
  });

  // Admin creates doctor profile
  const availability = [
    {
      dayOfWeek: 1, // Monday
      startTime: '09:00',
      endTime: '10:00',
    },
  ];

  const createDoctorRes = await request(app)
    .post('/api/doctors')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      userId: doctorUser.id,
      name: 'Dr Test',
      specialization: 'Cardiology',
      email: 'doctor@example.com',
      availability,
    });

  expect(createDoctorRes.status).toBe(201);
  expect(createDoctorRes.body.success).toBe(true);
  const doctor = createDoctorRes.body.data;

  // Admin generates slots for a specific future date to avoid time-based rejections
  const generateSlotsRes = await request(app)
    .post('/api/slots/generate')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      doctorId: doctor._id,
      startDate: '2099-01-01',
      endDate: '2099-01-01',
      slotDurationMinutes: 30,
      timezone: 'Asia/Kolkata',
    });

  expect(generateSlotsRes.status).toBe(201);
  expect(generateSlotsRes.body.success).toBe(true);

  return { admin, adminToken, doctor };
};

describe('Slot generation and listing with pagination', () => {
  test('admin can generate slots and list them with pagination', async () => {
    const { adminToken, doctor } = await setupDoctorAndSlots();

    const res = await request(app)
      .get(`/api/slots/doctor/${doctor._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ status: 'available', page: 1, limit: 5 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(5);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.count).toBeLessThanOrEqual(5);
  });
});

describe('Booking flows: double-booking prevention and state transitions', () => {
  test('user can book a slot, double-booking is prevented, and cancellation works', async () => {
    const { adminToken, doctor } = await setupDoctorAndSlots();

    // Create normal user
    await registerUser({
      name: 'User One',
      email: 'user1@example.com',
      password: 'Password1',
      role: 'user',
    });
    const userToken = await loginUser({
      email: 'user1@example.com',
      password: 'Password1',
    });

    // User lists available slots for that doctor on the generated date
    const availableRes = await request(app)
      .get('/api/slots/available')
      .set('Authorization', `Bearer ${userToken}`)
      .query({ doctorId: doctor._id, date: '2099-01-01' });

    expect(availableRes.status).toBe(200);
    expect(availableRes.body.success).toBe(true);
    expect(Array.isArray(availableRes.body.data)).toBe(true);
    expect(availableRes.body.data.length).toBeGreaterThan(0);

    const slotId = availableRes.body.data[0]._id;

    // First booking should succeed
    const createBookingRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ slotId });

    expect(createBookingRes.status).toBe(201);
    expect(createBookingRes.body.success).toBe(true);
    const bookingId = createBookingRes.body.data._id;

    // Second booking on same slot should be rejected (double-booking prevention)
    const doubleBookingRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ slotId });

    expect(doubleBookingRes.status).toBe(400);
    expect(doubleBookingRes.body.success).toBe(false);
    expect(doubleBookingRes.body.message).toBe('Slot is already booked');

    // User cancels the booking; status and slot should update
    const cancelRes = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ cancellationReason: 'Change of plans' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.success).toBe(true);
    expect(cancelRes.body.data.bookingStatus).toBe('cancelled');
    expect(cancelRes.body.data.slotId.status).toBe('available');
  });

  test('admin can expire past bookings and my-bookings pagination works', async () => {
    const { adminToken, doctor } = await setupDoctorAndSlots();

    // Create user
    const user = await registerUser({
      name: 'User Two',
      email: 'user2@example.com',
      password: 'Password1',
      role: 'user',
    });
    const userToken = await loginUser({
      email: 'user2@example.com',
      password: 'Password1',
    });

    // Manually create a past slot and confirmed booking via models
    const Slot = require('../src/models/Slot');
    const Booking = require('../src/models/Booking');

    const pastSlot = await Slot.create({
      doctorId: doctor._id,
      date: new Date('2000-01-01T09:00:00Z'),
      startTime: '09:00',
      endTime: '09:30',
      status: 'booked',
      timezone: 'Asia/Kolkata',
    });

    const booking = await Booking.create({
      userId: user.id,
      slotId: pastSlot._id,
      doctorId: doctor._id,
      bookingStatus: 'confirmed',
    });

    // Expire past bookings
    const expireRes = await request(app)
      .patch('/api/bookings/expire-past')
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(expireRes.status).toBe(200);
    expect(expireRes.body.success).toBe(true);
    expect(expireRes.body.count).toBeGreaterThanOrEqual(1);

    const updated = await Booking.findById(booking._id).lean();
    expect(updated.bookingStatus).toBe('expired');

    // My bookings with pagination
    const myBookingsRes = await request(app)
      .get('/api/bookings/my-bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .query({ page: 1, limit: 10 });

    expect(myBookingsRes.status).toBe(200);
    expect(myBookingsRes.body.success).toBe(true);
    expect(myBookingsRes.body.page).toBe(1);
    expect(myBookingsRes.body.limit).toBe(10);
    expect(Array.isArray(myBookingsRes.body.data)).toBe(true);
  });
});

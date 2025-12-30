# Doctor Appointment System API

A role-based doctor appointment booking API built with Node.js, Express, MongoDB, and JWT, featuring slot generation, robust booking states, and centralized validation/error handling.

---

## Features

- **Authentication & Authorization**
  - JWT-based authentication (`Authorization: Bearer <token>`).
  - Role-based access control with `admin` and `user` roles.

- **Doctor Management**
  - Admins create doctor profiles linked to user accounts.
  - Weekly availability per doctor (`dayOfWeek`, `startTime`, `endTime`).

- **Slot Management**
  - Generate appointment slots over a date range from doctor availability.
  - Unique index on `(doctorId, date, startTime)` prevents duplicate slots.
  - Timezone stored per slot (e.g. `Asia/Kolkata`).

- **Booking Lifecycle**
  - Users/Admins can book available slots.
  - Strong double-booking prevention:
    - Application checks + Mongo partial unique index on `Booking.slotId` for active states.
  - Booking states: `pending`, `confirmed`, `cancelled`, `completed`, `expired`.
  - Time-based guards for booking, cancelling, rescheduling, completing.
  - Admin endpoint to expire past bookings.

- **Validation & Error Handling**
  - Centralized validation via `express-validator` helpers.
  - Custom error classes (`AppError`, `ValidationError`, etc.).
  - Centralized error handler for consistent JSON error responses.

- **Pagination**
  - Pagination support on key listing endpoints (doctors, slots, bookings).

---

## Tech Stack

- **Backend:** Node.js, Express.js  
- **Database:** MongoDB (Mongoose)  
- **Auth:** JSON Web Tokens (JWT)  
- **Validation:** express-validator  

---

## Getting Started

### Prerequisites

- Node.js (LTS)
- npm
- MongoDB instance (local or remote)
### Environment Variables

Create a .env file in the project root:
•  MONGO_URI – MongoDB connection string.
•  JWT_SECRET – secret for signing/verifying JWTs.
•  JWT_EXPIRES_IN – token expiry (e.g. 1d, 7d).
•  PORT – API port (defaults to 5000 if omitted).
•  NODE_ENV – development, test, or production.


The API will be available at:http://localhost:5000
## API Overview
All protected routes expect: Authorization: Bearer <jwt_token>
### Auth Routes (/api/auth)

•  POST /api/auth/register - Register a new user.
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "Password1",
    "role": "user"   // optional: "admin" or "user"
  }
•  POST /api/auth/login - Login and receive a JWT.
   {
    "email": "john@example.com",
    "password": "Password1"
  }
•  GET /api/auth/me - Get current authenticated user.

•  GET /api/auth/admin-only - Example admin-only protected route.

### Doctor Routes (/api/doctors)

•  POST /api/doctors (admin) - Create a doctor profile linked to a user.
   {
    "userId": "USER_OBJECT_ID",
    "name": "Dr Test",
    "specialization": "Cardiology",
    "email": "doctor@example.com",
    "availability": [
      {
        "dayOfWeek": 1,
       "startTime": "09:00",
        "endTime": "17:00"
      }
    ]
  }
  •  GET /api/doctors (admin, user) - List doctors (paginated).
  Query (optional):
•  page: positive integer
•  limit: 1–50
•  GET /api/doctors/:id (admin, user)  
  Get doctor by ID.

### Slot Routes (/api/slots)

•  POST /api/slots/generate (admin) - Generate slots for a doctor over a date range.
   {
    "doctorId": "DOCTOR_OBJECT_ID",
    "startDate": "2025-01-01",
    "endDate": "2025-01-07",
    "slotDurationMinutes": 30,
    "timezone": "Asia/Kolkata"
  }
•  GET /api/slots/available (admin, user) - List available slots by filters + pagination.
  Query (optional):
 •  doctorId: doctor ObjectId
 •  Either date: YYYY-MM-DD  
 •  Or startDate, endDate: YYYY-MM-DD
 •  page: positive integer
 •  limit: 1–50
•  GET /api/slots/doctor/:doctorId (admin, user) - List slots for a doctor (with filters + pagination).
  Query (optional):
 •  status: available | booked | blocked
 •  page: positive integer
 •  limit: 1–50
•  PATCH /api/slots/:slotId/block (admin) - Block a slot.
•  DELETE /api/slots/:slotId (admin) - Delete a slot.

### Booking Routes (/api/bookings)

•  POST /api/bookings (admin, user) - Create a booking for a given slot.
  {
    "slotId": "SLOT_OBJECT_ID"
  }
•  GET /api/bookings/my-bookings (admin, user) - List bookings of the current user (paginated).
  Query (optional):
 •  page: positive integer
 •  limit: 1–50
•  GET /api/bookings (admin) - List all bookings (paginated).
  Query (optional):
 •  page: positive integer
 •  limit: 1–50
•  PATCH /api/bookings/:id/cancel (admin or owner) - Cancel a booking (only if not completed/expired and slot is not in the past).
  {
    "cancellationReason": "Change of plans"
  }
•  PATCH /api/bookings/:id/reschedule (owner user) - Reschedule to a new slot for the same doctor (new slot must be available and not in the past).
   {
    "newSlotId": "NEW_SLOT_OBJECT_ID"
  }
•  PATCH /api/bookings/:id/complete (admin) - Mark a booking as completed (only for past slots).

•  PATCH /api/bookings/expire-past (admin) - Mark all eligible pending/confirmed bookings whose slots are in the past as expired.

## Project Structure
doctor-appointment-system/
├── src/
│   ├── config/
│   │   └── database.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Doctor.js
│   │   ├── Slot.js
│   │   └── Booking.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── slotController.js
│   │   └── bookingController.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── slotRoutes.js
│   │   └── bookingRoutes.js
│   ├── middlewares/
│   │   ├── authMiddleware.js
│   │   ├── roleMiddleware.js
│   │   └── errorHandler.js
│   ├── utils/
│   │   ├── validation.js
│   │   └── slotGenerator.js
│   └── app.js
├── .env
├── .gitignore
├── package.json
└── server.js

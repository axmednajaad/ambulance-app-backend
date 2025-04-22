import prisma from '../config/db.js';
import { sendResponse } from '../utils/response.js';

// import { notifyAdmin } from './notification.service.js';

// Helper function for distance calculation
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

export const createRequest = async (req, res,next) => {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.user.userId;

    // Validate coordinates
    if (isNaN(latitude) || isNaN(longitude)) {
      return sendResponse(res, 400, 'error', 'Valid latitude and longitude are required');
    }

    // Check for existing pending request
    const existingRequest = await prisma.ambulanceRequest.findFirst({
      where: {
        patientId: userId,
        status: { in: ['PENDING', 'ACCEPTED'] }
      }
    });

    if (existingRequest) {
      return sendResponse(res, 400, 'error', existingRequest.status === 'ACCEPTED'
        ? 'You already have an accepted request'
        : 'You already have a pending request');
    }

    const request = await prisma.$transaction(async (tx) => {
      const newRequest = await tx.ambulanceRequest.create({
        data: {
          patientId: userId,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        },
      });

      // Find nearby available drivers
      const nearbyDrivers = await findNearbyDrivers(latitude, longitude);

      if (nearbyDrivers.length > 0) {
        // Emit only to nearby drivers
        nearbyDrivers.forEach(driver => {
          req.io.to(driver.id).emit('new_request', {
            requestId: newRequest.id,
            patientId: userId,
            location: { latitude, longitude },
            createdAt: newRequest.createdAt
          });
        });
      } else {
        // No drivers available - escalate to admin
        await tx.ambulanceRequest.update({
          where: { id: newRequest.id },
          data: { status: 'ESCALATED' }
        });
        // notifyAdmin(`No available drivers for request ${newRequest.id}`);
      }

      return newRequest;
    });

    // Set timeout for request (e.g., 2 minutes)
    setTimeout(async () => {
      const timedOutRequest = await prisma.ambulanceRequest.findUnique({
        where: { id: request.id }
      });

      if (timedOutRequest?.status === 'PENDING') {
        await prisma.ambulanceRequest.update({
          where: { id: request.id },
          data: { status: 'TIMEOUT' }
        });
        req.io.to(userId).emit('request_timeout', { requestId: request.id });
        // notifyAdmin(`Request ${request.id} timed out without response`);
      }
    }, 120000); // 2 minutes

   return sendResponse(res, 201, 'success', 'Request created', { request });
  } catch (err) {
    console.error('Error in createRequest:', err);
    next(err);
  }
};

export const acceptRequest = async (req, res,next) => {
  try {
    const requestId = req.params.id;
    const driverId = req.user.userId;

    const request = await prisma.ambulanceRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      return sendResponse(res, 404, "Request not found");
    }

    if (request.status !== 'PENDING') {
      return sendResponse(res, 400, `Request is already ${request.status.toLowerCase()}`);
    }

    // Mark driver as unavailable
    await prisma.user.update({
      where: { id: driverId },
      data: { isAvailable: false }
    });

    const updated = await prisma.ambulanceRequest.update({
      where: { id: requestId },
      data: {
        acceptedById: driverId,
        status: 'ACCEPTED',
        rejectionCount: 0 // Reset rejection count
      },
      include: {
        patient: {
          select: { id: true }
        }
      }
    });

    // Notify patient
    req.io.to(updated.patientId).emit('request_accepted', {
      requestId: updated.id,
      driverId,
      driverLocation: await getDriverLocation(driverId)
    });

    return sendResponse(res, 200, "Request Accepted", {
      data : updated,
    });
  } catch (err) {
    console.error('Error in acceptRequest:', err);
    next(err);
  }
};

export const rejectRequest = async (req, res, next) => {
  try {
    const requestId = req.params.id;
    const driverId = req.user.userId;

     await prisma.$transaction(async (tx) => {
      const currentRequest = await tx.ambulanceRequest.findUnique({
        where: { id: requestId },
        include: { patient: true }
      });

      if (!currentRequest) {
        return sendResponse(res, 404, 'Request not found');
      }

      if (currentRequest.status !== 'PENDING') {
        return sendResponse(res, 400, `Request is already ${currentRequest.status.toLowerCase()}`);
      }

      const updatedRequest = await tx.ambulanceRequest.update({
        where: { id: requestId },
        data: { rejectionCount: { increment: 1 } },
        include: { patient: true }
      });

      if (updatedRequest.rejectionCount >= 3) {
        await tx.ambulanceRequest.update({
          where: { id: requestId },
          data: { status: 'ESCALATED' }
        });
        return sendResponse(res, 200, 'Request escalated to admin', { data: updatedRequest });
      }

      const nearbyDrivers = await findNearbyDrivers(
        updatedRequest.latitude,
        updatedRequest.longitude
      );

      const eligibleDrivers = nearbyDrivers.filter(driver => driver.id !== driverId);

      if (eligibleDrivers.length > 0) {
        req.io.to(eligibleDrivers[0].id).emit('new_request', {
          requestId: updatedRequest.id,
          patientId: updatedRequest.patientId,
          location: {
            latitude: updatedRequest.latitude,
            longitude: updatedRequest.longitude
          },
          rejectionCount: updatedRequest.rejectionCount
        });
      } else {
        await tx.ambulanceRequest.update({
          where: { id: requestId },
          data: { status: 'ESCALATED' }
        });
        return sendResponse(res, 200, 'No available drivers. Request escalated to admin', { data: updatedRequest });
      }

      return sendResponse(res, 200, 'Request rejected and reassigned', { data: updatedRequest });
    });

  } catch (err) {
    console.error('Error in rejectRequest:', err);
    next(err);
  }
};


export const completeRequest = async (req, res,next) => {
  try {
    const requestId = req.params.id;
    const driverId = req.user.userId;

    const request = await prisma.ambulanceRequest.findUnique({
      where: { id: requestId },
      include: { patient: true }
    });

    if (!request || request.acceptedById !== driverId) {
      return sendResponse(res, 403, 'Not authorized to complete this request');
    }

    if (request.status !== 'ACCEPTED') {
      return sendResponse(res, 400, `Request is ${request.status.toLowerCase()} and cannot be completed`);
    }

    const [updated, _] = await prisma.$transaction([
      prisma.ambulanceRequest.update({
        where: { id: requestId },
        data: { status: 'COMPLETED' }
      }),
      prisma.user.update({
        where: { id: driverId },
        data: { isAvailable: true }
      })
    ]);

    // Notify patient
    req.io.to(request.patientId).emit('request_completed', {
      requestId: updated.id
    });

    return sendResponse(res, 200, 'Request completed', { data: updated });
  } catch (err) {
    console.error('Error in completeRequest:', err);
    next(err);
  }
};

export const findNearbyDrivers = async (lat, lng, radiusKm = 5) => {
  try {
    const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  return await prisma.$queryRaw`
    SELECT * FROM (
      SELECT
        "User".id,
        "User".email,
        "Location".latitude,
        "Location".longitude,
        6371 * acos(
          cos(radians(${latitude})) *
          cos(radians("Location".latitude)) *
          cos(radians("Location".longitude) - radians(${longitude})) +
          sin(radians(${latitude})) *
          sin(radians("Location".latitude))
        ) AS distance
      FROM "User"
      JOIN "Location" ON "User".id = "Location"."userId"
      WHERE "User".role = 'DRIVER'
      AND "User"."isAvailable" = true
    ) AS drivers_with_distance
    WHERE distance <= ${radiusKm}
    ORDER BY distance
    LIMIT 10
  `;
  } catch (err) {
    console.error('Error in findNearbyDrivers:', err);
    throw err;
  }
};

// Helper function to get driver's location
const getDriverLocation = async (driverId) => {
  const location = await prisma.location.findUnique({
    where: { userId: driverId },
    select: { latitude: true, longitude: true }
  });
  return location || null;
};

// Location update handler for drivers
export const updateDriverLocation = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    const driverId = req.user.userId;

    if (isNaN(latitude) || isNaN(longitude)) {
      return sendResponse(res, 400, 'Invalid coordinates');
    }

    // Update or insert driver's location
    const location = await prisma.location.upsert({
      where: { userId: driverId },
      update: { latitude, longitude },
      create: {
        latitude,
        longitude,
        userId: driverId
      }
    });

    // Check if there's an active request for this driver
    const activeRequest = await prisma.ambulanceRequest.findFirst({
      where: {
        acceptedById: driverId,
        status: 'ACCEPTED'
      },
      select: { patientId: true }
    });

    // If yes, broadcast updated location to patient
    if (activeRequest) {
      req.io.to(activeRequest.patientId).emit('driver_location_update', {
        latitude,
        longitude,
        updatedAt: new Date()
      });
    }

    return sendResponse(res, 200, 'Location updated', { location });
  } catch (err) {
    console.error('Error in updateDriverLocation:', err);
    next(err);
  }
};

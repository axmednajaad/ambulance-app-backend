const socketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log(`🚦 Socket connected: ${socket.id}`);

    // Store user info with socket
    let userInfo = null;

    // Register user with their ID and role
    socket.on('register', async ({ userId, role }, callback) => {
      try {
        userInfo = { userId, role };

        // Join user-specific room
        socket.join(userId);

        // Join role-specific rooms
        if (role === 'DRIVER') {
          socket.join('drivers');

          // Mark as available if not already
          await prisma.user.update({
            where: { id: userId },
            data: { isAvailable: true }
          });
        } else if (role === 'PATIENT') {
          socket.join('patients');
        }

        console.log(`User ${userId} registered as ${role}`);
        callback({ success: true });
      } catch (err) {
        console.error('Registration error:', err);
        callback({ success: false, error: err.message });
      }
    });

    // Handle driver location updates
    socket.on('update_location', async ({ lat, lng }, callback) => {
      if (!userInfo || userInfo.role !== 'DRIVER') {
        return callback({ success: false, error: 'Unauthorized' });
      }

      try {
        // Update database
        await prisma.location.upsert({
          where: { userId: userInfo.userId },
          update: { latitude: lat, longitude: lng },
          create: {
            latitude: lat,
            longitude: lng,
            userId: userInfo.userId
          }
        });

        // Find active request
        const activeRequest = await prisma.ambulanceRequest.findFirst({
          where: {
            acceptedById: userInfo.userId,
            status: 'ACCEPTED'
          },
          select: { patientId: true }
        });

        // Broadcast to patient
        if (activeRequest) {
          io.to(activeRequest.patientId).emit('driver_location', {
            lat,
            lng,
            timestamp: new Date().toISOString()
          });
        }

        callback({ success: true });
      } catch (err) {
        console.error('Location update error:', err);
        callback({ success: false, error: err.message });
      }
    });

    socket.on('ping_test', (data) => {
      console.log(`greeting : ${JSON.stringify(data)}`);
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      if (!userInfo) return;

      console.log(`⚠️ User ${userInfo.userId} (${userInfo.role}) disconnected`);

      // Mark driver as unavailable if they disconnect
      if (userInfo.role === 'DRIVER') {
        try {
          await prisma.user.update({
            where: { id: userInfo.userId },
            data: { isAvailable: false }
          });

          // Find and timeout any accepted requests
          const activeRequest = await prisma.ambulanceRequest.findFirst({
            where: {
              acceptedById: userInfo.userId,
              status: 'ACCEPTED'
            }
          });

          if (activeRequest) {
            await prisma.ambulanceRequest.update({
              where: { id: activeRequest.id },
              data: { status: 'CANCELLED' }
            });

            io.to(activeRequest.patientId).emit('driver_disconnected', {
              requestId: activeRequest.id
            });
          }
        } catch (err) {
          console.error('Cleanup error:', err);
        }
      }
    });

    // Heartbeat/ping mechanism
    const interval = setInterval(() => {
      socket.emit('ping', { timestamp: Date.now() });
    }, 30000); // 30 seconds

    socket.on('pong', () => {
      // Connection is alive
    });

    socket.on('disconnect', () => {
      clearInterval(interval);
    });
  });
};

export default socketHandler;

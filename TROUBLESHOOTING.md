# Troubleshooting Guide

## ECONNRESET Error

The `ECONNRESET` error indicates a network connection was reset. This can happen for several reasons:

### 1. Database Connection Issues

**Symptoms:**
- `ECONNRESET` when accessing database
- MongoDB connection errors in logs

**Solutions:**
1. Check MongoDB connection string in `.env`:
   ```env
   MONGO_URI=mongodb://localhost:27017/your-database
   ```

2. Test database connection:
   ```bash
   curl http://localhost:4000/health
   ```

3. Check if MongoDB is running:
   ```bash
   # For local MongoDB
   sudo systemctl status mongod
   
   # For MongoDB Atlas
   # Check network access and IP whitelist
   ```

### 2. Email Service Issues

**Symptoms:**
- `ECONNRESET` when sending emails
- Email configuration errors

**Solutions:**
1. Test email connection:
   ```bash
   curl http://localhost:4000/api/contracts/test-connections
   ```

2. Check email configuration in `.env`:
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   ```

3. Verify Gmail settings:
   - 2-Factor Authentication enabled
   - App password generated
   - Less secure app access (if using regular password)

### 3. Network/Firewall Issues

**Symptoms:**
- Intermittent connection errors
- Timeout errors

**Solutions:**
1. Check firewall settings
2. Verify network connectivity
3. Check if running behind proxy

### 4. Memory/Resource Issues

**Symptoms:**
- Server becomes unresponsive
- Connection drops under load

**Solutions:**
1. Monitor server resources:
   ```bash
   # Check memory usage
   free -h
   
   # Check CPU usage
   top
   ```

2. Increase Node.js memory limit:
   ```bash
   node --max-old-space-size=4096 server.js
   ```

## Diagnostic Steps

### Step 1: Check Server Health
```bash
curl http://localhost:4000/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "environment": "development"
}
```

### Step 2: Test Database Connection
```bash
curl http://localhost:4000/api/contracts/test-connections
```

Expected response:
```json
{
  "status": "success",
  "database": "OK",
  "email": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Step 3: Check Server Logs
Look for these patterns in your server logs:

**Database Issues:**
```
Failed to connect to MongoDB: [error]
MongoDB connection error: [error]
```

**Email Issues:**
```
Email configuration error: [error]
Email connection: FAILED
```

**General Issues:**
```
Error in getUserNotifications: [error]
Error in getPendingApprovals: [error]
```

## Common Fixes

### 1. Restart Services
```bash
# Restart your application
pm2 restart your-app-name

# Or if running directly
node server.js
```

### 2. Clear Node.js Cache
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### 3. Check Environment Variables
```bash
# Verify .env file exists and has correct values
cat .env

# Check if variables are loaded
node -e "require('dotenv').config(); console.log(process.env.MONGO_URI)"
```

### 4. Database Connection Pool
If using MongoDB Atlas, add connection options:
```javascript
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
```

## Prevention

### 1. Add Connection Monitoring
```javascript
// In server.js
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  // Add alerting/notification here
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
  // Add reconnection logic here
});
```

### 2. Add Request Timeouts
```javascript
// Add timeout to all database queries
const user = await User.findById(userId).select('notifications').maxTimeMS(5000);
```

### 3. Add Circuit Breaker
Consider implementing a circuit breaker pattern for external services like email.

## Getting Help

If the issue persists:

1. **Collect logs**: Save all server logs for the time period when the error occurred
2. **Check environment**: Verify all environment variables and configurations
3. **Test isolation**: Try the failing endpoint in isolation
4. **Check dependencies**: Ensure all npm packages are up to date

### Debug Mode
Enable debug mode by setting:
```env
NODE_ENV=development
DEBUG=*
```

This will provide more detailed error information and stack traces. 
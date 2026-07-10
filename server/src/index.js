import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`[server] InterviewIQ API running on port ${PORT}`);
  console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[server] Allowed CORS origins: ${process.env.CLIENT_URL || 'None defined'}`);
});

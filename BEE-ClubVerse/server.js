import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import dotenv from 'dotenv';
import debugModule from 'debug';
import axios from 'axios';

const debug = debugModule('clubverse:server');
debug('Starting server...');


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;


app.get('/api/weather', async (req, res) => {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey || apiKey === 'your_openweather_api_key_here') {
      return res.render('weather', {
        ldh: {
          city: 'Ludhiana',
          temp: Math.floor(Math.random() * 15 + 18), 
          condition: ['Clear', 'Partly Cloudy', 'Cloudy', 'Light Rain'][Math.floor(Math.random() * 4)],
          icon: '01d'
        },
        chd: {
          city: 'Chandigarh',
          temp: Math.floor(Math.random() * 15 + 18), 
          condition: ['Clear', 'Partly Cloudy', 'Cloudy', 'Light Rain'][Math.floor(Math.random() * 4)],
          icon: '02d'
        },
        isMocked: true,
        message: 'Showing mock weather data (add OPENWEATHER_API_KEY to .env for real data)'
      });
    }
    
    const ldhRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=Ludhiana,in&appid=${apiKey}&units=metric`,
      { timeout: 5000 }
    );
    
    const chdRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=Chandigarh,in&appid=${apiKey}&units=metric`,
      { timeout: 5000 }
    );
    const ldhWeather = ldhRes.data;
    const chdWeather = chdRes.data;
    res.render('weather', {
      ldh: {
        city: ldhWeather.name,
        temp: ldhWeather.main.temp,
        condition: ldhWeather.weather[0].description,
        icon: ldhWeather.weather[0].icon
      },
      chd: {
        city: chdWeather.name,
        temp: chdWeather.main.temp,
        condition: chdWeather.weather[0].description,
        icon: chdWeather.weather[0].icon
      },
      isMocked: false
    });
  } catch (error) {
    console.error('Weather API error:', error.message);
    res.render('weather', {
      ldh: {
        city: 'Ludhiana',
        temp: Math.floor(Math.random() * 15 + 18),
        condition: ['Clear', 'Partly Cloudy', 'Cloudy', 'Light Rain'][Math.floor(Math.random() * 4)],
        icon: '01d'
      },
      chd: {
        city: 'Chandigarh',
        temp: Math.floor(Math.random() * 15 + 18),
        condition: ['Clear', 'Partly Cloudy', 'Cloudy', 'Light Rain'][Math.floor(Math.random() * 4)],
        icon: '02d'
      },
      isMocked: true,
      message: 'Unable to fetch real weather data. Showing mock data.'
    });
  }
});

app.get('/test-debug', (req, res) => {
  debug('Someone opened /test-debug route');
  res.send('Debugging works!');
});


import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import logger, { logger as winstonLogger } from './middlewares/logger.js';
import errorHandler from './middlewares/errorHandler.js';
import { protect, authorize, checkPermission, createLoginLimiter } from './middlewares/authAdvanced.js';
import connectDB from './db.js';
import { initPostgres } from './db.postgres.js';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(morgan('dev'));
app.use(helmet.contentSecurityPolicy({
  useDefaults: true,
  directives: {
    "default-src": ["'self'", "*"],
    "img-src": ["'self'", "https:", "data:"],
    "script-src": ["'self'", "*", "'unsafe-inline'"],
    "script-src-attr": ["'self'", "*", "'unsafe-inline'"]
  }
}));
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  headers: true,
  standardHeaders: true,
  skip: (req) => req.user && req.user.role === 'admin' 
});

const loginLimiter = createLoginLimiter(5, 15 * 60 * 1000);

const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many requests. Please try again later.',
  headers: true
});

app.use('/api', generalLimiter);

app.use(logger);

app.use((req, res, next) => {
  winstonLogger.info(`Incoming request: ${req.method} ${req.url}`);
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth/login', loginLimiter);
app.use('/api', authRoutes);

import apiRoutes from './api/apiRoutes.js';
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  const { error, success } = req.query;
  res.render('login', { error, success });
});

app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.get('/api/dashboard', protect, (req, res) => {
  const instaImages = [
    'food.jpg', 'drink.jpg', 'pizza.jpg', 'beerr.avif',
    'hand.png', 'taco.png',
    'drum.png', 'wine.png'
  ];
  res.render('dashboard', {
    instaImages,
    user: req.user
  });
});

const chdBars = [
  { name: "BREWESTATE", image: "/images/brewestate.png", link: "/api/brewestate" },
  { name: "BOULEVARD", image: "/images/boul.png", link: "/api/boulevard" },
  { name: "KALA-GHODA", image: "/images/kalaghoda.jpg", link: "/api/kalaghoda" },
  { name: "MOBE", image: "/images/mobe.png", link: "/api/mobe" }
];

const ldhBars = [
  { name: "PAARA - NIGHT CLUB", image: "/images/paara2.jpg", link: "/api/paara" },
  { name: "ROMEO LANE", image: "/images/romeolane.jpg", link: "/api/romeo-ldh" },
  { name: "LUNA - NIGHT CLUB", image: "/images/luna2.avif", link: "/api/luna-ldh" },
  { name: "BAKLAVI - BAR & KITCHEN", image: "/images/baklavi.jpg", link: "/api/baklavi-ldh" }
];

app.get('/api/bar', protect, (req, res) => {
  res.render('baars', {
    chdBars,
    ldhBars,
    user: req.user
  });
});

app.get('/api/reserve-table', protect, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'reservation.html'));
});

app.get('/api/team', protect, (req, res) => {
  const team = [
    { name: "Ansh Vohra", role: "Back-End Web Developer", image: "/images/ansh.jpg" },
    { name: "Akhil Handa", role: "Back-End Web Developer", image: "/images/akhil.jpg" },
    { name: "Anmol Singh", role: "Back-End Web Developer", image: "/images/anmol11.jpg" }
  ];
  res.render('team', { team, user: req.user });
});



app.get('/weather', async (req, res) => {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey || apiKey === 'your_openweather_api_key_here') {
      return res.render('weather', {
        ldh: {
          city: 'Ludhiana',
          temp: Math.floor(Math.random() * 15 + 18), 
          condition: ['Clear', 'Partly Cloudy', 'Cloudy', 'Light Rain'][Math.floor(Math.random() * 4)],
          icon: '01d'
        },
        chd: {
          city: 'Chandigarh',
          temp: Math.floor(Math.random() * 15 + 18),
          condition: ['Clear', 'Partly Cloudy', 'Cloudy', 'Light Rain'][Math.floor(Math.random() * 4)],
          icon: '02d'
        },
        isMocked: true,
        message: 'Showing mock weather data (add OPENWEATHER_API_KEY to .env for real data)'
      });
    }
    
    const ldhRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=Ludhiana,in&appid=${apiKey}&units=metric`,
      { timeout: 5000 }
    );
    
    const chdRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=Chandigarh,in&appid=${apiKey}&units=metric`,
      { timeout: 5000 }
    );
    const ldhWeather = ldhRes.data;
    const chdWeather = chdRes.data;
    res.render('weather', {
      ldh: {
        city: ldhWeather.name,
        temp: ldhWeather.main.temp,
        condition: ldhWeather.weather[0].description,
        icon: ldhWeather.weather[0].icon
      },
      chd: {
        city: chdWeather.name,
        temp: chdWeather.main.temp,
        condition: chdWeather.weather[0].description,
        icon: chdWeather.weather[0].icon
      },
      isMocked: false
    });
  } catch (error) {
    console.error('Error fetching weather:', error.message);
    res.render('weather', {
      ldh: {
        city: 'Ludhiana',
        temp: Math.floor(Math.random() * 15 + 18),
        condition: ['Clear', 'Partly Cloudy', 'Cloudy', 'Light Rain'][Math.floor(Math.random() * 4)],
        icon: '01d'
      },
      chd: {
        city: 'Chandigarh',
        temp: Math.floor(Math.random() * 15 + 18),
        condition: ['Clear', 'Partly Cloudy', 'Cloudy', 'Light Rain'][Math.floor(Math.random() * 4)],
        icon: '02d'
      },
      isMocked: true,
      message: 'Unable to fetch real weather data. Showing mock data.'
    });
  }
});



const barPages = ['brewestate', 'boulevard', 'kalaghoda', 'mobe', 'paara', 'romeo-ldh', 'luna-ldh', 'baklavi-ldh'];
barPages.forEach(page => {
  app.get(`/api/${page}`, protect, (req, res) => {
    res.render(page, { user: req.user });
  });
});

const staticPages = ['faq', 'ourservices', 'contactus'];
staticPages.forEach(page => {
  app.get(`/api/${page}`, (req, res) => {
    res.render(page);
  });
});

app.use(errorHandler);

winstonLogger.info("DEBUG MONGO_URI:", { mongoUri: process.env.MONGO_URI });

connectDB();
initPostgres().catch(err => {
  winstonLogger.warn('PostgreSQL initialization failed:', err.message);
});

//abc
let server;

process.on('uncaughtException', (err) => {
  winstonLogger.error('Uncaught Exception:', err);
  if (server) {
    server.close(() => {
      winstonLogger.info('Server closed due to uncaught exception');
      mongoose.connection.close(() => {
        winstonLogger.info('MongoDB connection closed');
        process.exit(1);
      });
    });
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  winstonLogger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (server) {
    server.close(() => {
      winstonLogger.info('Server closed due to unhandled rejection');
      mongoose.connection.close(() => {
        winstonLogger.info('MongoDB connection closed');
        process.exit(1);
      });
    });
  } else {
    process.exit(1);
  }
});

server = app.listen(PORT, () => {
  winstonLogger.info(`Server is running at http://localhost:${PORT}`);
});

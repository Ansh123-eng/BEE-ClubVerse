import jwt from 'jsonwebtoken';
import User from '../models/user.js';

const protect = async (req, res, next) => {
  let token;

  try {
    
    if (!process.env.JWT_SECRET) {
      console.error('ERROR: JWT_SECRET is not defined in environment variables');
      return res.status(500).redirect('/?error=server_config_error');
    }

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {

      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {

      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).redirect('/?error=unauthorized');
    }


    const decoded = jwt.verify(token, process.env.JWT_SECRET);


    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).redirect('/?error=invalid_user');
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    return res.status(401).redirect('/?error=token_error');
  }
};

export { protect };

import dotenv from 'dotenv';
import mongoose from 'mongoose';


dotenv.config();

const connectDB = async () => {
    try {
        console.log('DEBUG MONGO_URI:', process.env.MONGO_URI);
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;

const connectDB = require('./db');
const User = require('./models/user');
const bcrypt = require('bcrypt');

const seedData = async () => {
    await connectDB();
    try {
        const hashedPassword = await bcrypt.hash('test123', 10); 
        const user = new User({
            name: 'Test User',
            email: 'test@example.com',
            password: hashedPassword,
        });
        await user.save();
        console.log('Test user added:', user);
    } catch (error) {
        console.error('Error seeding data:', error.message);
    } finally {
        process.exit();
    }
};

seedData();
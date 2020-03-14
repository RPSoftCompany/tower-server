module.exports = {
    db: {
        name: 'db',
        connector: 'memory',
    },
    mongoDB: {
        hostname: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 27017,
        database: 'tower',
        password: process.env.DB_PASSWORD || '',
        name: 'mongoDB',
        useNewUrlParser: 'true',
        useUnifiedTopology: true,
        user: process.env.DB_USER || '',
        connector: 'mongodb',
    },
};

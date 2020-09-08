module.exports = {
    db: {
        name: 'db',
        connector: 'memory',
    },
    mongoDB: {
        url: 'mongodb+srv://tower:1elEJICQRdH848mw@mongocluster-ehuwu.mongodb.net/test?retryWrites=true&w=majority',
        name: 'mongoDB',
        connector: 'mongodb',
        useUnifiedTopology: true,
        useNewUrlParser: true,
        useCreateIndex: true,
    },
};

module.exports = {
    db: {
        name: 'db',
        connector: 'memory',
    },
    mongoDB: {
        url: 'mongodb://localhost:27017,localhost:27018,localhost:27019/test?replicaSet=rs0',
        name: 'mongoDB',
        connector: 'mongodb',
    },
};

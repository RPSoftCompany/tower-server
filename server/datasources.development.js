module.exports = {
    db: {
        name: 'db',
        connector: 'memory',
    },
    mongoDB: {
        url: 'mongodb://localhost:27117,localhost:27127,localhost:27137/test?replicaSet=rs0',
        name: 'mongoDB',
        connector: 'mongodb',
    },
};

# Tower
Tower Configuration Server is a tool, to store and easily serve configuration for your applications. The most important feature in Tower, is its flexibility. It can serve your configuration in the way you want, using templates you'll provide.

# Architecture
Tower has two main components, tower-server and tower-client. Tower-server is a back end part of this solution, and is responsible for exposing REST services and storing/collecting data from MongoDB database. Tower-client, on the other side, is a GUI to allow user easily change configuration. As data storage, Tower uses MongoDB database.

# Prerequisites
To start Tower, you'll need a MongoDB cluster with at least three replicas. Single mongo will not do the trick, as Tower is using watch functionality, which is available only for clusters with three or more replicas.
For the development, you can go with [one server cluster](https://docs.mongodb.com/manual/tutorial/deploy-replica-set-for-testing/) or [Mongo Atlas free tier](https://www.mongodb.com/cloud/atlas).

# How to start
To start your journey with Tower, you'll need to 
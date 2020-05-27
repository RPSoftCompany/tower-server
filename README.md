# Tower
Tower Configuration Server is a tool, to store and easily serve configuration for your applications. The most important feature in Tower, is its flexibility. It can serve your configuration in the way you want, using templates you'll provide.

## Architecture
Tower has two main components, [tower-server](https://github.com/RPSoftCompany/tower-server) and [tower-client](https://github.com/RPSoftCompany/tower-client). Tower-server is a back end part of this solution, and is responsible for exposing REST services and storing/collecting data from MongoDB database. Tower-client, on the other side, is a GUI to allow user easily change configuration. As data storage, Tower uses MongoDB database.

## Prerequisites
To start Tower, you'll need a MongoDB cluster with at least three replicas. Single mongo will not do the trick, as Tower is using watch functionality, which is available only for clusters with three or more replicas.
For the development, you can go with [one server cluster](https://docs.mongodb.com/manual/tutorial/deploy-replica-set-for-testing/) or [Mongo Atlas free tier](https://www.mongodb.com/cloud/atlas).

## How to start
To start your journey with Tower, all you need to do, is update the [datasources.development.json](https://github.com/RPSoftCompany/tower-server/blob/master/server/datasources.development.js) file with your mongo configuration and that's basically all. Not mentioning the `npm install` and `npm start` of course.

## Docker
Tower can also be started in docker. An official Tower image can be found [here](https://hub.docker.com/r/rpsofttower/tower).

## Basics
Tower-server is based on [loopback](https://loopback.io/lb3), so you can find out about the project structure in its documentation. But of course Tower adds its structure as well. But from the begging...
Tower stores information about any kind of configuration, or at least that is its main purpose (but of course you can store there anything you want). There are few main models, that you should know about before you start changing them:

### Base configuration
First model you need to know about, is 'base configuration'. As Tower is generic in terms of storing data and you can define how you'd like to store your data, 'base configuration' model describes your way of thinking.
So, for example, if your company has different **environments** like development, qa, production, etc. you can say, that one of your 'base configurations' is **Environment**. Of course, all those environments has a bunch of **applications**. So your other 'base configuration' can be **Application** and so on.
This is just an example, but of course, your organization can use buckets and cups to describe its resources, it's not my concern. All you need to know, is in Tower, structure is generic, you decide how it looks.

### Configuration model
'Configuration model' is an instance of 'base configuration'. It means, that, if you have **Environment** as you 'base configuration', then 'configuration model' for it can be, for example **dev**, **qa**, **prod** and so on. You can have any number of 'configuration models' for one 'base configuration' as you want.

### Configuration
With that said, we can talk about the 'configuration' model. Just like the name suggests, this model stores your configuration. 'Configuration' is based on 'configuration models', it means, that each 'configuration' has, for example, its **Environment**, **Application** and sometimes buckets and cups. So, when you want collect your applications configuration from Tower, you ask for data for specific **Environment** and **Application** or even something more or less (depending on your rest configuration)

### REST configuration
Speaking of the devil, REST configuration in Tower is generic as well. It means, that you decide how configuration will be served to your application. REST configuration in Tower uses templates. Each template can be provided by you and filled any way you like.
So, for example, if you would like to provide your configuration for MongoDB, then without Tower, you would provide file similar to this:

    storage:
	    dbPath: /var/lib/mongodb
	    journal:
	        enabled: true
	systemLog:
	    destination: file
	    logAppend: true
	    path: /var/log/mongodb/mongod.log
    net:
	    port: 27017
	    bindIp: 127.0.0.1
    processManagement:
	    timeZoneInfo: /usr/share/zoneinfo

But this file has no variables you can use... So how can we generate such file from Tower? It's quite simple. Lets assume, that we want to set IP and port to a different one, so we create two different variables in our configuration called **IP** and **port**. After that, we can use those values like that:

    storage:
	    dbPath: /var/lib/mongodb
	    journal:
	        enabled: true
	systemLog:
	    destination: file
	    logAppend: true
	    path: /var/log/mongodb/mongod.log
    net:
	    port: %%variables[IP]%%
	    bindIp: %%variables[port]%%
    processManagement:
	    timeZoneInfo: /usr/share/zoneinfo
	    
So we just changed the IP and port values to **%%variables[IP]%%** and **%%variables[port]%%**. So in other words, you can use **%%variable[\<variable_name\>]%%** to use values from your configuration.
But you would say "do I need to use this method for all of my 127 variables?!". And the answer is no... This is just a basic example. When you've got many different variables and for example you would like to serve them as a json key/value pairs, then all you need to do, is create your 'REST configuration' like this:

	{
	%%forEach var in variables%%
		"%%var.name%%":"%%var.value%%"
	%%forEach END%%
	}

You can use 'for' loop in Towers templates. This loop has four different sections, the first one is of course word 'forEach', which obviously indicates, that this is a 'for each' loop. Second part is your for variable name... In this case, I've named it **var**, but you can name it anyway you want. The third part, is **in** word. There can be an **in** or **of**, but I will talk about **of** in a sec... So the **in** word indicates, that we're just collecting data from next variable, so from **variables**. And **variables** is a special word, which describes all variables in you configuration.
We've started the loop, but what next? It's simple, each variable from this loop (in our case variables are named **var**) have **name**, **value** and **type**, so if we want to display key/value pairs, then we just write **"%%var.name%%":"%%var.value%%"**. But of course you can do anything you want with values you receive.

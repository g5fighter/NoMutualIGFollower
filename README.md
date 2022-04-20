# No Mutual IG Follower
This script lets you know wich users doesn't follow you but filtering big accounts.

## How to use
- In .env file put your user and password. If you have 2fa the program will ask you to introduce it if necessary.
- In top of script you will find the following lines, edit them acoording to your needs.
```
// Configure the app
const sesionPath = "./data/ig.json";
const userToSearch = ['user1','user2']; // List of all searched users
const followerLimit = 5000; // if -1 we get all the followers
const timeMargin = 6;
const listPath = "";
const listFileName = "followers_";
```
- Run the program and you will get on a file the complete list

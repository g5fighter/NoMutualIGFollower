# No Mutual IG Follower
This script lets you know wich users doesn't follow you but filtering big accounts.

## How to use
- Run the program 
- You will be asked to introduce:
  * Username
  * Password
  * Users to search
  * Follower limit
- If you have 2fa the program will ask you to introduce it if necessary.
- And you will get the complete list in a file for each user

- In top of script you will find the following lines, edit them acoording to your needs.
```
// Configure the app
const sesionPath = "./ig.json";
var userToSearch = [];
var followerLimit; // if -1 we get all the followers
const timeMargin = 6;
const listPath = "";
const listFileName = "followers_";
```

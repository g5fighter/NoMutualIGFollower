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
// Calcular previamente el numero de esperas
// Configure the app
var loggedUser = '';
var userToSearch = [];
// if -1 we get all the following
// if -2 we get all the following but divided in tiers -> 5,10,50,100,500,1000 in k
var followerLimit; 
const timeMargin = 6;
const listPath = "";
const listFileName = "followers_";

// Get the feed several times
const exhaustiveMode = 5;
```

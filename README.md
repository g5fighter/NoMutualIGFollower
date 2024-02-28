# No Mutual IG Follower

This Python script helps you identify users on Instagram who don't follow you back, while also filtering out accounts with a large number of followers.

## How to Use
1. Run the script.
2. You'll be prompted to enter the following information:
    - Your Instagram username
    - Your Instagram password
    - Users you want to search for
    - Follower limit (accounts exceeding this limit will be filtered out)
3. If you have two-factor authentication enabled, the program will request it if necessary.
4. After execution, you'll receive a complete list of users in separate files for each user.

## Configuration
At the top of the script, you'll find the following lines. Edit them according to your preferences:
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
Feel free to adjust these settings to tailor the script to your specific needs.

import 'dotenv/config';

import {
  IgApiClient,
  IgLoginTwoFactorRequiredError
} from 'instagram-private-api';

const DEBUG = false;

const ig = new IgApiClient();
import fsNorm from 'fs';
const fs = fsNorm.promises;
import inquirer from 'inquirer';
import Bluebird from 'bluebird';

// Configure the app
var loggedUser = ''; // The user who is logged in
var userToSearch = []; // The users we want to search

// if -1 we get all the following
// if -2 we get all the following but divided in tiers -> 5,10,50,100,500,1000 in k
var followerLimit;
const followerLimits = [5000, 10000, 50000, 100000, 500000, Infinity]; // The follower limits for the tiers

const timeMargin = 6; // The time margin for the exhaustive mode
const listPath = ""; // The path where the lists will be saved
const listFileName = "followers_"; // The name of the file

const exhaustiveMode = 5; // The amount of times we will get the following list



/**
 * Returns the session path for the logged user.
 * @returns {string} The session path.
 */
function SesionPath() {
  return loggedUser + ".json";
}

/**
 * Saves the data to a file or database.
 * @param {any} data - The data to be saved.
 */
function Save(data) {
  fsNorm.writeFileSync(SesionPath(), JSON.stringify(data), function (err, result) {
    if (err) console.error(err);
  });
}

/**
 * Checks if the data exists.
 * @returns {boolean} Returns true if the data exists, otherwise false.
 */
async function Exists() {
  try {
    if (!fsNorm.existsSync(SesionPath())) {
      return false;
    }

    const data = await fs.readFile(SesionPath(), 'utf8');
    return data != "";

  } catch (err) {
    console.error(err)
    return false;
  }
}

/**
 * Loads data from a file.
 * @returns {Promise<Object>} The parsed JSON data from the file.
 */
async function Load() {
  const data = await fs.readFile(SesionPath(), 'utf8')
  // console.log(data)
  return JSON.parse(data);
}

/**
 * Tries to load a session and checks if it is still valid.
 * @returns {Promise<boolean>} A promise that resolves to true if the session is valid, false otherwise.
 */
async function tryLoadSession() {

  if (!Exists()){
    if (DEBUG) console.log("No session found");
    return false;
  }
  try {
    await ig.state.deserialize(await Load());
    // try any request to check if the session is still valid
    await ig.account.currentUser();
    return true;
  } catch (e) {
    if (DEBUG) {
      console.log("Error loading session");
      console.log(e);
      console.log(e.stack);
    }
    return false;
  }
}

/**
 * Logs in the user.
 * @returns {Promise<void>} A promise that resolves when the login process is complete.
 */
async function login() {
  console.log("|- Logging in");
  const {
    username
  } = await inquirer.prompt([{
    type: 'input',
    name: 'username',
    message: `Enter your username`,
  },]);
  loggedUser = username;
  ig.state.generateDevice(username);
  ig.state.proxyUrl = process.env.IG_PROXY;
  // This function executes after every request
  ig.request.end$.subscribe(async () => {
    const serialized = await ig.state.serialize();
    delete serialized.constants; // this deletes the version info, so you'll always use the version provided by the library
    Save(serialized);
  });

  if (!(await tryLoadSession())) {
    const {
      password
    } = await inquirer.prompt([{
      type: 'password',
      mask: '*',
      name: 'password',
      message: `Enter your password`,
    },]);
    // This call will provoke request.end$ stream
    return Bluebird.try(() => ig.account.login(username, password)).catch(
      IgLoginTwoFactorRequiredError,
      async err => {
        const {
          username,
          totp_two_factor_on,
          two_factor_identifier
        } = err.response.body.two_factor_info;
        // decide which method to use
        const verificationMethod = totp_two_factor_on ? '0' : '1'; // default to 1 for SMS
        // At this point a code should have been sent
        // Get the code
        const {
          code
        } = await inquirer.prompt([{
          type: 'input',
          name: 'code',
          message: `Enter code received via ${verificationMethod === '1' ? 'SMS' : 'TOTP'}`,
        },]);
        // Use the code to finish the login process
        return ig.account.twoFactorLogin({
          username,
          verificationCode: code,
          twoFactorIdentifier: two_factor_identifier,
          verificationMethod, // '1' = SMS (default), '0' = TOTP (google auth for example)
          trustThisDevice: '1', // Can be omitted as '1' is used by default
        });
      },
    ).catch(e => {
      console.log(e);
      if (DEBUG) console.log(e.stack);
      process.exit(1);
    });
    // Most of the time you don't have to login after loading the state
  } else {
    console.log("|- Session loaded");
  }
}

login().then(async () => {
  console.log("|- Logged in");
  console.log('------------------------------------------------------');
  console.log("|- Introduce one by one all users you want to search");

  do {
    var {
      userEntered
    } = await inquirer.prompt([{
      type: 'input',
      name: 'userEntered',
      message: `Enter a user (press enter to stop)`,
    },]);
    if (userEntered != "") {
      userToSearch.push(userEntered);
    }
  } while (userEntered != "");

  console.log('------------------------------------------------------');
  const {
    follLimit
  } = await inquirer.prompt([{
    type: 'input',
    name: 'follLimit',
    message: `Enter a follower limit (-1 is no limit, -2 is divided in tiers)`,
  },]);

  //userToSearch.push

  followerLimit = parseInt(follLimit)

  for (let searchedUser in userToSearch) {
    console.log('-------------------------------------------------------');
    console.log("|- Searching " + userToSearch[searchedUser]);
    const targetUser = await ig.user.searchExact(userToSearch[searchedUser]);

    console.log("|- Getting feed");
    const followingFeed = ig.feed.accountFollowing(targetUser.pk);
    const followersFeed = ig.feed.accountFollowers(targetUser.pk);

    const followers = await getAllItemsFromFeed(followersFeed);
    const following = await getAllItemsFromFeed(followingFeed);

    console.log(`Follower Count: ${followers.length} - Following Count: ${following.length}`);

    const followersUsername = new Set(followers.map(({ username }) => username));

    let notFollowingYou;
    // Get to times the users feed
    if (exhaustiveMode != 0) {
      console.log("|- Exhaustive mode activated");
      // for from 0 to exhaustive mode
      var globalUsernamesSet = new Set([...followersUsername]);
      var globalAllFollowing = following;

      var times = [];
      var timeAmount = 0;
      for (var i = 0; i < exhaustiveMode; i++) {
        var time = Math.round(Math.random() * timeMargin * 1000) + 1000;
        timeAmount += time;
        times.push(time);
      }
      timeAmount /= 1000;
      console.log("Estimated time: " + Math.trunc((timeAmount / 60)) + " minutes " + Math.trunc((timeAmount % 60)) + " seconds");
      for (var i = 0; i < exhaustiveMode; i++) {

        console.log(`|- Getting feed ${(2 + i)} - Remaining time: ${Math.trunc((timeAmount / 60))} minutes ${Math.trunc((timeAmount % 60))} seconds`);
        await new Promise(resolve => setTimeout(resolve, times[i]));
        const followingFeed2 = ig.feed.accountFollowing(targetUser.pk);
        const followersFeed2 = ig.feed.accountFollowers(targetUser.pk);

        const followers2 = await getAllItemsFromFeed(followersFeed2);
        const following2 = await getAllItemsFromFeed(followingFeed2);

        console.log(`Follower Count: ${followers2.length} - Following Count: ${following2.length}`);

        const followersUsername2 = new Set(followers2.map(({ username }) => username));

        globalUsernamesSet = new Set([...globalUsernamesSet, ...followersUsername2]);
        globalAllFollowing = [...globalAllFollowing, ...following2];

        timeAmount -= (times[i] / 1000);
      }
      // Filter the ones who are not following you
      notFollowingYou = globalAllFollowing.filter(({ username }) => !globalUsernamesSet.has(username));

    } else {
      // Filtering through the ones who aren't following you.
      notFollowingYou = following.filter(({ username }) => !followersUsername.has(username));
    }

    var myNeededUsers = new Map();
    notFollowingYou.forEach(user => myNeededUsers.set(user.username, user.pk));

    await GetFinalList(myNeededUsers, userToSearch[searchedUser]);
  }
});


/**
 * Retrieves the final list filtering users with more than followerLimit followers
 * @param {Map} users - The map of users.
 * @param {string} user - The user.
 * @returns {void}
 */
async function GetFinalList(users, user) {
  // console.log("Getting final list");
  // 5,10,50,100,500,1000 

  const userMaps = followerLimits.map(() => new Map());

  if (followerLimit != -1) {
    const iterator1 = users.entries();
    var valIndex = 1;
    const remainingItems = users.size;

    const times = Array.from({ length: remainingItems }, () => {
      const time = Math.round(Math.random() * timeMargin * 1000) + 1000;
      return time;
    });
    let timeAmount = times.reduce((a, b) => a + b, 0) / 1000;

    console.log("Estimated time: " + Math.trunc((timeAmount / 60)) + " minutes " + Math.trunc((timeAmount % 60)) + " seconds");

    let exitFromWhile = false;
    let val;
    while ((val = iterator1.next().value) != undefined || exitFromWhile) {
      console.log(`Checking: ${valIndex}/${remainingItems} - Remaining time: ${Math.trunc((timeAmount / 60))} minutes ${Math.trunc((timeAmount % 60))} seconds`);
      valIndex++;
      ig.user.info(val[1]).then(foll => {
        handleFollowerCount(foll, val, userMaps);
      }).catch(error => {
        console.log(error);
        exitFromWhile = true;
      });
      timeAmount -= (times[valIndex - 2] / 1000);
      await new Promise(resolve => setTimeout(resolve, times[valIndex - 2]));
    }
  }
  saveResponses(userMaps, user);
}

/**
 * Handles the follower count of a user and performs actions based on the count.
 * @param {Object} foll - The follower object containing the follower count.
 * @param {Array} val - The value array containing user information.
 * @param {Array<Map>} userMaps - The array of user maps.
 */
function handleFollowerCount(foll, val, userMaps) {
  if (followerLimit == -2) {
    const index = followerLimits.findIndex(limit => foll.follower_count <= limit);
    userMaps[index].set(val[0], val[1]);
  } else {
    if (foll.follower_count > followerLimit) {
      users.delete(val[0]);
    }
  }
  console.log(`${val[0]} -> Follower Count: ${foll.follower_count}`);
}

/**
 * Saves the responses for a given user.
 * @param {Array} userMaps - An array of user maps.
 * @param {string} user - The user name.
 */
function saveResponses(userMaps, user) {
  if (followerLimit == -2) {
    userMaps.forEach((map, index) => {
      SaveResponse(map, `${user}_${followerLimits[index]}k`);
    });
  } else {
    SaveResponse(users, user);
  }
}

/**
 * Saves the response string to a file.
 * @param {string} string - The response string to be saved.
 * @param {string} user - The user identifier.
 * @returns {Promise<void>} - A promise that resolves when the file is saved successfully.
 */
async function SaveResponse(string, user) {
  const result = [...string.keys()].flat().join('\n')
  var fileName = listPath + listFileName + user + ".txt";
  console.log("|- Saved in " + fileName);
  fs.writeFile(fileName, result, function (err, result) {
    if (err) console.error(err);
  });
}

/**
 * Retrieves all items from a feed.
 * @param {Feed} feed - The feed to retrieve items from.
 * @returns {Promise<Array>} - A promise that resolves to an array of items.
 */
async function getAllItemsFromFeed(feed) {
  let items = [];
  do {
    items = items.concat(await feed.items());
  } while (feed.isMoreAvailable());
  return items;
}
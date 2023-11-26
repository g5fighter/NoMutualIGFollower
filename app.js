import 'dotenv/config';

import {
    IgApiClient,
    IgLoginTwoFactorRequiredError
} from 'instagram-private-api';

const ig = new IgApiClient();
import fsNorm from 'fs';
const fs = fsNorm.promises;
import inquirer from 'inquirer';
import Bluebird from 'bluebird';

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

const exhaustiveMode = 5;

function SesionPath(){
  return loggedUser+".json";
}

function Save(data) {
  // here you would save it to a file/database etc.
  fsNorm.writeFileSync(SesionPath(), JSON.stringify(data), function(err, result) {
    if(err) console.error(err);
  });
}

async function Exists() {
  // here you would check if the data exists
  try {
    if(fsNorm.existsSync(SesionPath())){
      const data = await fs.readFile(SesionPath(), 'utf8')
      if(data==""){
        return false;
      }else{
        return true;
      }
    }else{
      return false;
    }
  } catch(err) {
    console.error(err)
    return false;
  }
}

async function Load() {
  const data = await fs.readFile(SesionPath(), 'utf8')
  // console.log(data)
  return JSON.parse(data); 
}

async function tryLoadSession() {
  if (await Exists()) {
    try {
      await ig.state.deserialize(await Load());
      // try any request to check if the session is still valid
      await ig.account.currentUser();
      return true;
    } catch (e) {
      return false;
    }
  }else{
    return false;
  }
}

async function login() {
  console.log("|- Logging in");
  const {
    username
  } = await inquirer.prompt([{
    type: 'input',
    name: 'username',
    message: `Enter your username`,
  }, ]);
  loggedUser = username;
  ig.state.generateDevice(username);
  ig.state.proxyUrl = process.env.IG_PROXY;
  // This function executes after every request
  ig.request.end$.subscribe(async () => {
    const serialized = await ig.state.serialize();
    delete serialized.constants; // this deletes the version info, so you'll always use the version provided by the library
    Save(serialized);
  });

  if(!(await tryLoadSession())) {
    const {
      password
    } = await inquirer.prompt([{
      type: 'password',
      mask: '*',
      name: 'password',
      message: `Enter your password`,
    }, ]);
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
        }, ]);
        // Use the code to finish the login process
        return ig.account.twoFactorLogin({
          username,
          verificationCode: code,
          twoFactorIdentifier: two_factor_identifier,
          verificationMethod, // '1' = SMS (default), '0' = TOTP (google auth for example)
          trustThisDevice: '1', // Can be omitted as '1' is used by default
        });
      },
    ).catch(e => {console.log(e); console.log(e.stack); process.exit(1);});
    // Most of the time you don't have to login after loading the state
  }else{
    console.log("|- Session loaded");
  }
}

login().then(async () => {
  console.log("|- Logged in");
  console.log('------------------------------------------------------');
  console.log("|- Introduce one by one all users you want to search");

  do{
    var {
      userEntered
    } = await inquirer.prompt([{
      type: 'input',
      name: 'userEntered',
      message: `Enter a user (press enter to stop)`,
    }, ]);
    if(userEntered!=""){
      userToSearch.push(userEntered);
    }
  }while(userEntered!="");

  console.log('------------------------------------------------------');
  const {
    follLimit
  } = await inquirer.prompt([{
    type: 'input',
    name: 'follLimit',
    message: `Enter a follower limit (-1 is no limit, -2 is divided in tiers)`,
  }, ]);

  //userToSearch.push

  followerLimit = parseInt(follLimit)

  for(searchedUser in userToSearch){
    console.log('-------------------------------------------------------');
    console.log("|- Searching "+userToSearch[searchedUser]);
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
    if(exhaustiveMode != 0){
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
      timeAmount/=1000;
      console.log("Estimated time: "+Math.trunc((timeAmount/60))+" minutes "+Math.trunc((timeAmount%60))+" seconds");
      for(var i=0; i<exhaustiveMode; i++){
        
        console.log(`|- Getting feed ${(2+i)} - Remaining time: ${Math.trunc((timeAmount/60))} minutes ${Math.trunc((timeAmount%60))} seconds`);
        await new Promise(resolve => setTimeout(resolve, times[i]));
        const followingFeed2 = ig.feed.accountFollowing(targetUser.pk);
        const followersFeed2 = ig.feed.accountFollowers(targetUser.pk);
  
        const followers2 = await getAllItemsFromFeed(followersFeed2);
        const following2 = await getAllItemsFromFeed(followingFeed2);

        console.log(`Follower Count: ${followers2.length} - Following Count: ${following2.length}`);

        const followersUsername2 = new Set(followers2.map(({ username }) => username));
      
        globalUsernamesSet = new Set([...globalUsernamesSet, ...followersUsername2]);
        globalAllFollowing = [...globalAllFollowing, ...following2];
      
        timeAmount-=(times[i]/1000);
      }
      // Filter the ones who are not following you
      notFollowingYou = globalAllFollowing.filter(({ username }) => !globalUsernamesSet.has(username));

    }else{
          // Filtering through the ones who aren't following you.
      notFollowingYou = following.filter(({ username }) => !followersUsername.has(username));    
    }

    var myNeededUsers = new Map();
    notFollowingYou.forEach(user =>  myNeededUsers.set(user.username,user.pk));

    await GetFinalList(myNeededUsers,userToSearch[searchedUser]);
  }  
  });
  
  // This function will get the final list filtering users with more than followerLimit followers
  async function GetFinalList(users,user){
    // console.log("Getting final list");
    // 5,10,50,100,500,1000 
    var users5k = new Map();
    var users10k = new Map();
    var users50k = new Map();
    var users100k = new Map();
    var users500k = new Map();
    var users1000k = new Map();
    if(followerLimit != -1){
        const iterator1 = users.entries();
        var valIndex = 1;
        var remainingItems = users.size;
        
        var times = [];
        var timeAmount = 0;
        for (var i = 0; i < remainingItems; i++) {
          var time = Math.round(Math.random() * timeMargin * 1000) + 1000;
          timeAmount += time;
          times.push(time);
        }
        timeAmount/=1000;
        console.log("Estimated time: "+Math.trunc((timeAmount/60))+" minutes "+Math.trunc((timeAmount%60))+" seconds");
        var exitFromWhile = false;
        while((val = iterator1.next().value)!=undefined || exitFromWhile){
            console.log(`Checking: ${valIndex}/${remainingItems} - Remaining time: ${Math.trunc((timeAmount/60))} minutes ${Math.trunc((timeAmount%60))} seconds`);
            valIndex++;
            ig.user.info(val[1]).then(foll => {
              if(followerLimit==-2){
                if(foll.follower_count<=5000){
                  users5k.set(val[0],val[1]);
                }else if(foll.follower_count<=10000){
                  users10k.set(val[0],val[1]);
                }else if(foll.follower_count<=50000){
                  users50k.set(val[0],val[1]);
                }else if(foll.follower_count<=100000){
                  users100k.set(val[0],val[1]);
                }else if(foll.follower_count<=500000){
                  users500k.set(val[0],val[1]);
                }else{
                  users1000k.set(val[0],val[1]);
                }
              }else{
                if(foll.follower_count>followerLimit){
                  users.delete(val[0]);
                }
              }
              console.log(`${val[0]} -> Follower Count: ${foll.follower_count}`)
            }).catch(error =>{
              console.log(error);
              exitFromWhile = true;
            } );
            timeAmount-=(times[valIndex-2]/1000);
            await new Promise(resolve => setTimeout(resolve, times[valIndex-2]));
        }
    }
    if(followerLimit==-2){
      SaveResponse(users5k,user+"_5k");
      SaveResponse(users10k,user+"_10k");
      SaveResponse(users50k,user+"_50k");
      SaveResponse(users100k,user+"_100k");
      SaveResponse(users500k,user+"_500k");
      SaveResponse(users1000k,user+"_1000k");
    }else{
      SaveResponse(users,user);  
    }
}

// This function will save the response
async function SaveResponse(string,user){
    const result = [...string.keys()].flat().join('\n')
    var fileName = listPath+listFileName+user+".txt";
    console.log("|- Saved in "+fileName);
      fs.writeFile(fileName, result, function(err, result) {
        if(err) console.error(err);
      });
}

// This function will get all the items from a feed
async function getAllItemsFromFeed(feed) {
  let items = [];
  do {
    items = items.concat(await feed.items());
  } while (feed.isMoreAvailable());
  return items;
}
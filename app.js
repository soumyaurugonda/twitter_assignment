const express = require("express");
const app = express();
app.use(express.json());

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const databasePath = path.join(__dirname, "twitterClone.db");

let database = null;

const initializeDBAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http:/localhost:3000/");
    });
  } catch (error) {
    console.log("Database error is ${error.message}");
    process.exit(1);
  }
};

initializeDBAndServer();
//API 1

app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;

  // check if user exists
  const checkUser = `select username from user where username = '${username}';`;
  const dbUser = await database.get(checkUser);
  console.log(dbUser);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      //encrypt password
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `
      insert into user(username,name,password,gender) 
      values('${username}','${name}','${hashedPassword}','${gender}');`;

      const createUser = await database.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  }
});
///API 2

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await database.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

///API 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  /**user id from user */
  const getUserIdQuery = `
     SELECT user_id from user WHERE username='${username}';`;
  const getUserId = await database.get(getUserIdQuery);
  /**get follower id */
  const getFollowerIdsQuery = `
     SELECT following_user_id FROM follower WHERE follower_user_id=${getUserId.user_id};`;
  const getFollowerIds = await database.all(getFollowerIdsQuery);

  /**get follower ids Array */
  const getFollowerIdsSimple = getFollowerIds.map((eachUser) => {
    return eachUser.following_user_id;
  });
  //query
  const getTweetQuery = `
     SELECT user.username,tweet.tweet,tweet.date_time as dateTime FROM user INNER JOIN tweet ON
     user.user_id=tweet.user_id where user.user_id in (${getFollowerIdsSimple})
     ORDER BY tweet.date_time desc limit 4;`;
  const responseResult = await database.all(getTweetQuery);
  response.send(responseResult);
});

///API 4
app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  /**user id from user */
  const getUserIdQuery = `
     SELECT user_id from user WHERE username='${username}';`;
  const getUserId = await database.get(getUserIdQuery);
  /**get follower id */
  const getFollowerIdsQuery = `
     SELECT following_user_id FROM follower WHERE follower_user_id=${getUserId.user_id};`;
  const getFollowerIdsArray = await database.all(getFollowerIdsQuery);

  /**get follower ids Array */
  const getFollowerIds = getFollowerIdsArray.map((eachUser) => {
    return eachUser.following_user_id;
  });
  const getFollowersResultQuery = `SELECT name from user where user_id in (${getFollowerIds});`;
  const responseResult = await database.all(getFollowersResultQuery);
  response.send(responseResult);
});
///API 5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  /**user id from user */
  const getUserIdQuery = `
     SELECT user_id from user WHERE username='${username}';`;
  const getUserId = await database.get(getUserIdQuery);
  /**get follower id */
  const getFollowerIdsQuery = `
     SELECT follower_user_id FROM follower WHERE following_user_id=${getUserId.user_id};`;
  const getFollowerIdsArray = await database.all(getFollowerIdsQuery);
  console.log(getFollowerIdsArray);
  /**get follower ids Array */
  const getFollowerIds = getFollowerIdsArray.map((eachUser) => {
    return eachUser.follower_user_id;
  });
  console.log(`${getFollowerIds}`);
  const getFollowersNameQuery = `SELECT name from user where user_id in (${getFollowerIds});`;
  const getFollowersName = await database.all(getFollowersNameQuery);
  response.send(getFollowersName);
});

//API 6

const api6Output = (tweetData, likesCount, replyCount) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: replyCount.replies,
    dateTime: tweetData.date_time,
  };
};

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  let { username } = request;
  const getUserIdQuery = `
     SELECT user_id from user WHERE username='${username}';`;
  const getUserId = await database.get(getUserIdQuery);
  //get the ids of whom the use is following
  const getFollowingIdsQuery = `
     SELECT following_user_id FROM follower WHERE follower_user_id=${getUserId.user_id};`;
  const getFollowingIdsArray = await database.all(getFollowingIdsQuery);
  console.log(getFollowerIdsArray);

  const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
    return eachFollower.following_user_id;
  });

  const getTweetIdsQuery = `SELECt tweet_id from tweet WHERE user_id in (${getFollowingIds});`;
  const getTweetIdsArray = await database.all(getTweetIdsQuery);
  const followingTweetIds = getTweetIdsArray.map((eachId) => {
    return eachId.tweet_id;
  });

  if (followingTweetIds.includes(parseInt(tweetId))) {
    const likes_count_query = `SELECT count(user_id) as likes from like WHERE tweet_id=${tweetId};`;
    const likes_count = await database.get(likes_count_query);

    const reply_count_query = `SELECT count(user_id) as replies from reply WHERE tweet_id=${tweetId};`;
    const reply_count = await database.get(reply_count_query);

    const tweet_tweetDateQuery = `SELECT tweet,date_time from tweet WHERE tweet_id=${tweetId};`;
    const tweet_tweetDate = await database.get(tweet_tweetDateQuery);
    response.send(api6Output(tweet_tweetDate, likes_count, reply_count));
  } else {
    response.status(401);
    response.send("Invalid Request");
    console.log("Invalid Request");
  }
});

///API 7
const convertLikedUserNameDBObjectToResponse = (dbObject) => {
  return {
    likes: dbObject,
  };
};

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const getUserIdQuery = `
     SELECT user_id from user WHERE username='${username}';`;
    const getUserId = await database.get(getUserIdQuery);
    //get the ids of whom the use is following
    const getFollowingIdsQuery = `
     SELECT following_user_id FROM follower WHERE follower_user_id=${getUserId.user_id};`;
    const getFollowingIdsArray = await database.all(getFollowingIdsQuery);
    console.log(getFollowingIdsArray);

    const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
      return eachFollower.following_user_id;
    });

    const getTweetIdsQuery = `SELECt tweet_id from tweet WHERE user_id in (${getFollowingIds});`;
    const getTweetIdsArray = await database.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((eachTweet) => {
      return eachTweet.tweet_id;
    });

    if (getTweetIds.includes(parseInt(tweetId))) {
      const getLikedUserNamesQuery = `SELECT user.username as likes from user INNER JOIN like ON 
        user.user_id=like.user_id where like.tweet_id=${tweetId};`;
      const getLikedUserNamesArray = await database.all(getLikedUserNamesQuery);
      const getLikedUserNames = getLikedUserNamesArray.map((eachUser) => {
        return eachUser.likes;
      });
      response.send(convertLikedUserNameDBObjectToResponse(getLikedUserNames));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
///API 8
const convertUserNameReplyDBObjectToResponseObject = (dbObject) => {
  return {
    replies: dbObject,
  };
};

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;

    const getUserIdQuery = `
     SELECT user_id from user WHERE username='${username}';`;
    const getUserId = await database.get(getUserIdQuery);
    //get the ids of whom the use is following
    const getFollowingIdsQuery = `
     SELECT following_user_id FROM follower WHERE follower_user_id=${getUserId.user_id};`;
    const getFollowingIdsArray = await database.all(getFollowingIdsQuery);
    console.log(getFollowerIdsArray);

    const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
      return eachFollower.following_user_id;
    });
    console.log(getFollowingIds);

    const getTweetIdsQuery = `SELECt tweet_id from tweet WHERE user_id in (${getFollowingIds});`;
    const getTweetIdsArray = await database.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((eachTweet) => {
      return eachTweet.tweet_id;
    });
    console.log(getTweetIds);
    if (getTweetIds.includes(parseInt(tweetId))) {
      const getUserNameReplyTweetsQuery = `SELECT user.name,reply.reply from user INNER JOIN reply ON 
        user.user_id=reply.user_id where reply.tweet_id=${tweetId};`;
      const getUserNameReplyTweets = await database.all(
        getUserNameReplyTweetsQuery
      );
      response.send(
        convertUserNameReplyDBObjectToResponseObject(getUserNameReplyTweets)
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

///API 9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `
     SELECT user_id from user WHERE username='${username}';`;
  const getUserId = await database.get(getUserIdQuery);

  const getTweetsQuery = `SELECT tweet,
  COUNT(DISTINCT like_id) AS likes,
  COUNT(DISTINCT reply_id) AS replies,
  date_time AS dateTime FROM tweet LEFT JOIN reply ON tweet.tweet_id=reply.tweet_id 
  LEFT JOIN like ON tweet.tweet_id=like.tweet_id
  WHERE tweet.user_id=${getUserId.user_id}
  GROUP BY tweet.tweet_id;`;
  const tweets = await database.all(getTweetsQuery);
  response.send(tweets);
});

///API 10
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `
     SELECT user_id from user WHERE username='${username}';`;
  const getUserId = await database.get(getUserIdQuery);
  const { tweet } = request.body;
  const currentDate = new Date();
  console.log(currentDate.toISOString().replace("T", " "));

  const postRequestQuery = `insert into tweet(tweet, user_id, date_time) 
  values ('${tweet}', ${getUserId.user_id},'${currentDate}');`;
  const responseResult = await database.run(postRequestQuery);
  const tweet_id = responseResult.lastId;
  response.send("Created a Tweet");
});
///API 11

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;

    let { username } = request;
    const getUserIdQuery = `
     SELECT user_id from user WHERE username='${username}';`;
    const getUserId = await database.get(getUserIdQuery);

    const getUserTweetsListQuery = `SELECT tweet_id from tweet WHERE user_id=${getUserId.user_id};`;
    const getUserTweetsListArray = await database.all(getUserTweetsListQuery);
    const getUserTweetsList = getUserTweetsListArray.map((eachTweetId) => {
      return eachTweetId.tweetId;
    });
    console.log(getUserTweetsList);
    if (getUserTweetsList.includes(parseInt(tweetId))) {
      const deleteTweetQuery = `delete from tweet where tweet_id=${tweet_id};`;
      await database.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
module.exports = app;

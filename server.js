// IMPORTS
import process from "process";
import url from "url";

import multer from "multer";
const upload = multer({ dest: "./tmp/" });

import crypto from "crypto";

import { MongoClient } from "mongodb";
import { saveToDisk } from "./utils/fs-helper.mjs";

// ---------------------------------------------------------------------
// Requuire
import { createRequire } from "module";
const require = createRequire(import.meta.url);
require("dotenv").config();
// mongo-cnxn string.
const cnxn_str = process.env.MONGODB_CNXN_STR;
console.log(`MONGO: ${cnxn_str}`);

import {
  addUserToMongo,
  getFromMongo,
  deleteFromMongo,
} from "./utils/mongo-helper.mjs";

// ---------------------------------------------------------------------
import path from "path";
const __dirname = path.resolve();

// ---------------------------------------------------------------------
// RateLimit - Prevent DoS attack - 15Minutes, 100Req(s) per IP.
// import rateLimit from "express-rate-limit";
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
// });

// ---------------------------------------------------------------------
// Express config.
import express from "express";
const app = express();

// Logging formatter.
import morgan from "morgan";
app.use(morgan("dev"));

// HTTP security.
import helmet from "helmet";
app.use(helmet());

// Limiter
app.use(limiter);

// Accept JSON
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

// set the view engine to ejs
app.set("view engine", "ejs");

// ---------------------------------------------------------------------
// Fetch PORT from env, else 8080
const server_port = process.env.YOUR_PORT || process.env.PORT || 8080;
const server_host = process.env.YOUR_HOST || "0.0.0.0";

const init = async () => {
  // Establish Mongo cnxn
  // ---------------------------------------------------------------------
  const client = new MongoClient(cnxn_str, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  await client.connect();

  // ---------------------------------------------------------------------
  // Renders input form.
  app.get("/register", (req, res) => {
    res.render("form");
  });

  // ---------------------------------------------------------------------
  // Process form data on submission.
  // // 1. Save username, emailid to Mongo.
  // // 2. Save image to disk if mongo action was successfully executed.
  app.post("/register", upload.single("avatar"), (req, res) => {
    // Validate Data.
    if (req.body.email && req.body.email !== "") {
      // Create a Unique Hash for Mongo _id
      var emailHash = crypto
        .createHash("md5")
        .update(req.body.email)
        .digest("hex");

      // ''' Add user-email to Mongo, with the hash as ID. '''
      addUserToMongo(
        client,
        { _id: emailHash, email: req.body.email, name: req.body.name },
        // Callback for failed MongoDB push.
        (err) => {
          console.log(`Saving user-email failed | @${req.body.email}`);
          let err_stack = err.stack.split("\n", 1).join("");

          let msg = err_stack;

          // Check error-code if user is already registered.
          if (err_stack.includes("E11000")) msg = "User is already registered!";

          res.redirect(
            url.format({
              pathname: "/status",
              query: {
                status: "failed",
                msg: msg,
              },
            })
          );
        },
        // Save image to Disk, if Mongo-action is successful.
        () =>
          saveToDisk(
            emailHash,
            __dirname,
            req,
            // Callback for successful writeToDisk
            () =>
              res.redirect(
                url.format({
                  pathname: "/status",
                  query: {
                    status: "successful",
                    msg: req.body.name,
                  },
                })
              ),
            // Callback for failed writeToDisk
            (err, code) => {
              // Delete from Mongo if Write fails.
              deleteFromMongo(client, emailHash);
              res.redirect(
                url.format({
                  pathname: "/status",
                  query: { status: "failed", msg: err },
                })
              );
            }
          )
      );
    }
  });

  // ---------------------------------------------------------------------
  // Renders current status, [User registration failed/succeded.]
  app.get("/status", (req, res) => {
    // Get attributes for status page.
    let isValid = req.query.status;
    let msg = req.query.msg;
    let icon = "times";

    // Nav Link
    let navLinkTitle = "Explore";
    let navLinkIcon = "wpexplorer";
    let navLink = "/explore";

    if (isValid === "successful") {
      msg = `Good job ${msg}!`;
      icon = "check";
    } else {
      navLink = "/register";
      navLinkIcon = "plus";
      navLinkTitle = "Try again";
    }

    res.render("status", {
      status: isValid,
      msg: msg,
      icon: icon,
      navLink: navLink,
      navLinkTitle,
      navLinkTitle,
      navLinkIcon: navLinkIcon,
    });
  });

  // ---------------------------------------------------------------------
  // Display all registered users.
  // ?? IDEALLY this API should implement authentication layer, but for easy Proof-of-Concept of registered users, it's OPEN.
  app.get("/explore", async (req, res) => {
    let result = await getFromMongo(client);
    // res.status(200).json({ res: result }).end();
    res.render("explore", { users: result });
  });

  // app.get("/clear-mongo", async (req, res) => {
  //   await deleteAllFromMongo(client);
  //   res.json({ msg: "done!" }).end();
  // });

  // ---------------------------------------------------------------------
  // Start-server
  app.listen(server_port, server_host, () => {
    console.log("Listening on port %d", server_port);
  });

  // ---------------------------------------------------------------------

  const cleanup = (event) => {
    //   Terminate mongo cnxn during exit().
    client.close();
    process.exit();
  };

  // Termination events.
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  //   Start server.
  console.log(`Server is listening on port ${server_port}`);
  console.log(`http://127.0.0.1:${server_port}/register`);
};

// Entrypoint
init().catch((err) => console.error(err));

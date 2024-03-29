import http from "http";
import https from "https";
import url from "url";
import fs from "fs";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import express from "express";
import cors from "cors";

// config
const PORT = process.env.PORT || 1337;
dotenv.config({ path: ".env" });
const app = express();
const connectionString: any = process.env.connectionString;
const DBNAME = "5b";
const whiteList = [
  "https://crudserver-andreavaira.onrender.com",
  "http://localhost:1337",
  "https://localhost:1338",
  "http://localhost:4200",
  "https://cordovaapp",
  "http://localhost:58903",
  ""
];
// const corsOptions = {
//   origin: function (origin:any, callback:any) {
//     if (!origin)
//       // browser direct call
//       return callback(null, true);
//     if (whiteList.indexOf(origin) === -1) {
//       var msg = `The CORS policy for this site does not
//  allow access from the specified Origin.`;
//       return callback(new Error(msg), false);
//     } else return callback(null, true);
//   },
//   credentials: true,
// };

const corsOptions = {
  origin: function (origin:any, callback:any) {
    return callback(null, true);
  },
  credentials: true,
};

const HTTPS_PORT = 1338;
const privateKey = fs.readFileSync("keys/privateKey.pem", "utf8");
const certificate = fs.readFileSync("keys/certificate.crt", "utf8");
const credentials = { key: privateKey, cert: certificate };

//CREAZIONE E AVVIO DEL SERVER HTTP
let server = http.createServer(app);
let paginaErrore: string = "";

server.listen(PORT, () => {
  init();
  // console.log("Server in ascolto sulla porta " + PORT);
});

let httpsServer = https.createServer(credentials, app);
httpsServer.listen(HTTPS_PORT, function () {
  console.log(
    "Server in ascolto sulle porte HTTP:" + PORT + ", HTTPS:" + HTTPS_PORT
  );
});

function init() {
  fs.readFile("./static/error.html", (err: any, data: any) => {
    if (err) {
      paginaErrore = "<h2>Risorsa non trovata</h2>";
    } else {
      paginaErrore = data.toString();
    }
  });
}

/***********MIDDLEWARE****************/
// 1 request log
app.use("/", (req: any, res: any, next: any) => {
  console.log(req.method + ": " + req.originalUrl);
  next();
});

// 2 gestione delle risorse statiche
//cerca le risorse nella cartella segnata nel path e li restituisce
app.use("/", express.static("./static"));

// 3 lettura dei parametri POST
app.use("/", express.json({ limit: "50mb" }));
app.use("/", express.urlencoded({ limit: "50mb", extended: true }));

// 5 log dei parametri get e post
app.use("/", (req: any, res: any, next: any) => {
  // parametri get .query, post .body
  if (Object.keys(req.query).length != 0) {
    console.log("---> Parametri GET: " + JSON.stringify(req.query));
  }
  if (Object.keys(req.body).length != 0) {
    console.log("---> Parametri BODY: " + JSON.stringify(req.body));
  }
  next();
});

// 6 Autorizzazioni CORS
app.use("/", cors(corsOptions));

// Apertura della connessione
app.use("/api/", (req: any, res: any, next: any) => {
  let connection = new MongoClient(connectionString);
  connection
    .connect()
    .catch((err: any) => {
      res.status(503);
      res.send("Errore di connessione al DB");
    })
    .then((client: any) => {
      req["connessione"] = client;
      next();
    });
});

/***********USER LISTENER****************/
app.get("/api/getCollections", (req: any, res: any, next: any) => {
  let db = req["connessione"].db(DBNAME);
  // Leggo tutte le collezioni del DB
  db.listCollections().toArray((err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore lettura connesioni");
    } else {
      res.send(data);
    }
    req["connessione"].close();
  });
});

app.get(
  "/api/richiestaParams/:gender/:hair",
  (req: any, res: any, next: any) => {
    let gender = req.params.gender;
    let hair = req.params.hair;

    let collection = req["connessione"].db(DBNAME).collection("unicorns");
    collection.find({ gender, hair }).toArray((err: any, data: any) => {
      if (err) {
        res.status(500);
        res.send("Errore esecuzione query");
      } else {
        res.send(data);
      }
      req["connessione"].close();
    });
  }
);

app.get("/api/:collection", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let param = req.query;

  let collection = req["connessione"].db(DBNAME).collection(collectionSelected);
  collection.find(param).toArray((err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      // let response = [];
      // for (const item of data) {
      //   let key = Object.keys(item)[1];
      //   response.push({ _id: item["_id"], val: item[key] });
      // }
      res.send(data);
    }
    req["connessione"].close();
  });
});

app.get("/api/:collection/:id", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let id = new ObjectId(req.params.id);

  let collection = req["connessione"].db(DBNAME).collection(collectionSelected);
  collection.findOne({ _id: id }, (err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send(data);
    }
    req["connessione"].close();
  });
});

// app.post("/api/getFirstQuadroArtista", (req: any, res: any) => {
//   let id = req.body.stream.id;
//   let collection = req["connessione"].db(DBNAME).collection("quadri");
//   collection
//     .find({ artist: id })
//     .toArray()
//     .then((data: any) => {
//       res.send(data);
//     })
//     .catch((err: any) => {
//       res.status(500);
//       res.send("Errore esecuzione query");
//     });
// });

app.delete("/api/:collection/:id", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let id = new ObjectId(req.params.id);

  let collection = req["connessione"].db(DBNAME).collection(collectionSelected);
  collection.deleteOne({ _id: id }, (err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send(data);
    }
    req["connessione"].close();
  });
});

app.patch("/api/:collection/:id", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let id = new ObjectId(req.params.id);

  let collection = req["connessione"].db(DBNAME).collection(collectionSelected);
  collection.updateOne(
    { _id: id },
    { $set: req.body },
    (err: any, data: any) => {
      if (err) {
        res.status(500);
        res.send("Errore esecuzione query");
      } else {
        res.send(data);
      }
      req["connessione"].close();
    }
  );
});

app.put("/api/:collection/:id", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let id = new ObjectId(req.params.id);

  let collection = req["connessione"].db(DBNAME).collection(collectionSelected);
  collection.replaceOne({ _id: id }, req.body, (err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send(data);
    }
    req["connessione"].close();
  });
});

app.post("/api/:collection", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let params = req.body;

  let collection = req["connessione"].db(DBNAME).collection(collectionSelected);
  collection.insertOne(params, (err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send(data);
    }
    req["connessione"].close();
  });
});

/***********DEFAULT ROUTE****************/

app.use("/", (req: any, res: any, next: any) => {
  res.status(404);
  if (req.originalUrl.startsWith("/api/")) {
    res.send("API non disponibile");
    req["connessione"].close();
  } else {
    res.send(paginaErrore);
  }
});

app.use("/", (err: any, req: any, res: any, next: any) => {
  if (req["connessione"]) {
    req["connessione"].close();
  }
  console.log("SERVER ERROR " + err.stack);
  res.status(500);
  res.send(err.message);
});

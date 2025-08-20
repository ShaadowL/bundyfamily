import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord";
import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const __dirname = path.resolve();

// ustawienia bazy Postgres
const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432
});

// konfiguracja widoków
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// session
app.use(session({
  secret: "supersecret",
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// passport Discord
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_REDIRECT_URI,
  scope: ["identify", "email"]
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // zapis do bazy jeśli potrzebujesz
    await pool.query(
      "INSERT INTO users (discord_id, username) VALUES ($1, $2) ON CONFLICT (discord_id) DO NOTHING",
      [profile.id, profile.username]
    );
    return done(null, profile);
  } catch (err) {
    console.error(err);
    return done(err, null);
  }
})) 

// ROUTES
app.get("/", (req, res) => res.render("login"));
app.get("/login", passport.authenticate("discord"));
app.get("/callback", passport.authenticate("discord", {
  failureRedirect: "/"
}), (req, res) => res.redirect("/dashboard"));

app.get("/dashboard", (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.render("dashboard", { user: req.user });
});

app.get("/logout", (req, res) => {
  req.logout(err => { if(err) console.error(err); });
  res.redirect("/");
});

// start serwera
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

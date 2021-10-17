import Client from "./Client";
import SongsClient from "./Songs/Client";
import ArtistsClient from "./Artists/Client";
import Song from "./Songs/Song";
import Artist from "./Artists/Artist";
import Album from "./Albums/Album";
import Utils from "./Utils";
import { Constants, Config } from "./Constants";

const version: string = require("../package.json").version;

export {
    Client,
    SongsClient,
    ArtistsClient,
    Song,
    Artist,
    Album,
    Constants,
    Config,
    Utils,
    version,
};

export default {
    Client,
    SongsClient,
    ArtistsClient,
    Song,
    Artist,
    Album,
    Constants,
    Utils,
    version,
};

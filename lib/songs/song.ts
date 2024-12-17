import { Client } from "../client";
import { Album } from "../albums/album";
import { Artist } from "../artists/artist";
import {
    InvalidTypeError,
    NoResultError,
    RequiresGeniusKeyError,
} from "../errors";
import { isBoolean, isString } from "../helpers/types";
import axios from "axios";
import { parse } from 'node-html-parser';

export class Song {
    title: string;
    fullTitle: string;
    featuredTitle: string;
    id: number;
    thumbnail: string;
    image: string;
    url: string;
    endpoint: string;
    artist: Artist;
    album?: Album;
    releasedAt?: Date;
    instrumental: boolean;
    _raw: any;

    // Add list of user agents
    private static readonly userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Edge/120.0.0.0',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];

    constructor(
        public readonly client: Client,
        res: any,
        public partial: boolean = false
    ) {
        this.title = res.title;
        this.fullTitle = res.full_title;
        this.featuredTitle = res.title_with_featured;
        this.id = parseInt(res.id);
        this.thumbnail = res.header_image_thumbnail_url;
        this.image = res.header_image_url;
        this.url = res.url;
        this.endpoint = res.api_path;
        this.artist = new Artist(this.client, res.primary_artist, true);
        this.partial = partial;
        this.album =
            !this.partial && res.album
                ? new Album(res.album, this.artist)
                : undefined;
        this.releasedAt =
            !this.partial && res.release_date
                ? new Date(res.release_date)
                : undefined;
        this.instrumental = res.instrumental;
        this._raw = res;
    }

    /**
     * Fetches lyrics of the track.
     * @example const Lyrics = await Song.lyrics(true);
     */
    async lyrics(removeChorus: boolean = false): Promise<string> {
        if (!isBoolean(removeChorus)) {
            throw new InvalidTypeError(
                "removeChorus",
                "boolean",
                typeof removeChorus
            );
        }

        try {
            const viewport = Song.getRandomViewport();
            const response = await axios.get(this.url, {
                headers: {
                    'User-Agent': Song.getRandomItem(Song.userAgents),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Referer': 'https://genius.com/',
                    'Origin': 'https://genius.com',
                    'Sec-Ch-Ua': '"Chromium";v="120", "Not(A:Brand";v="24"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"Windows"',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'max-age=0',
                    'Viewport-Width': viewport.width.toString(),
                    'Device-Memory': '8',
                    'Connection': 'keep-alive'
                },
                // Add random delay between 100-500ms
                timeout: 5000 + Math.floor(Math.random() * 400)
            });

            const root = parse(response.data);
            const containers = root.querySelectorAll('[data-lyrics-container="true"]');
            
            const lyrics = containers
                .map(container => {
                    let html = container.innerHTML;
                    html = html.replace(/<br\s*\/?>/gi, '\n');
                    html = html.replace(/<[^>]*>/g, '');
                    html = html.replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&#039;/g, "'")
                        .replace(/&nbsp;/g, ' ');
                    return html;
                })
                .join('\n')
                .trim();

            if (!lyrics?.length) {
                throw new NoResultError();
            }

            return removeChorus ? Song.removeChorus(lyrics) : lyrics;
        } catch (error: any) {
            if (error.response?.status === 403) {
                throw new Error('Access denied by Genius (403). Try using an API key.');
            }
            console.error('Error fetching lyrics:', error);
            throw error;
        }
    }

    /**
     * Fetches all information about the track and updates all the existing properties (requires key).
     * @example const NewSong = await Song.fetch();
     */
    async fetch(): Promise<Song> {
        if (!isString(this.client.key)) {
            throw new RequiresGeniusKeyError();
        }

        const data = await this.client.api.get(`/songs/${this.id}`);
        const parsed = JSON.parse(data);

        this.album = parsed.response.song.album
            ? new Album(parsed.response.song.album, this.artist)
            : undefined;
        this.releasedAt = parsed.response.song.release_date
            ? new Date(parsed.response.song.release_date)
            : undefined;
        this.partial = false;

        return this;
    }

    static removeChorus(lyrics: string): string {
        return lyrics.replace(/\[[^\]]+\]\n?/g, "");
    }

    // Helper method to get random item from array
    private static getRandomItem<T>(array: T[]): T {
        if (array.length === 0) throw new Error('Cannot get random item from empty array');
        const index = Math.floor(Math.random() * array.length);
        // Type assertion here is safe because we've checked array.length > 0
        return array[index]!;
    }

    // Helper to generate random viewport dimensions
    private static getRandomViewport() {
        const viewports = [
            { width: 1920, height: 1080 },
            { width: 1366, height: 768 },
            { width: 1536, height: 864 },
            { width: 1440, height: 900 },
            { width: 1280, height: 720 }
        ];
        return this.getRandomItem(viewports);
    }
}

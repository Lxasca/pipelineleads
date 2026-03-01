<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;
use GuzzleHttp\Client;

class ScrapController extends Controller
{
    public function step1(Request $request)
    {
        $validated = $request->validate([
            'page' => 'required|integer|min:1',
        ]);

        try {
            $response = Http::get('https://www.linternaute.com/ville/classement/villes/population', [
                'page' => $validated['page']
            ]);

            if (!$response->ok()) {
                throw new \Exception("Impossible de récupérer la page");
            }

            $crawler = new Crawler($response->body());

            $cities = $crawler->filter('table tr')->each(function ($row) {
                $cols = $row->filter('td');
                return $cols->count() >= 2 ? trim($cols->eq(1)->text()) : null;
                // pour ne pas prendre la ligner header avec le nom des colonnes
            });
            $cities = array_values(array_filter($cities));

            return response()->json([
                'success' => true,
                'message' => 'Réussite',
                'data' => $cities
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'data' => []
            ], 500);
        }
    }

    public function step2(Request $request) {

        $validated = $request->validate([
            'niche' => 'required|string'
        ]);

        $niche = $validated['niche'];

        return response()->json([
            'message' => 'Réussite',
            'data' => $niche
        ]);
    }

    public function step3(Request $request)
    {
        $validated = $request->validate([
            'cities' => 'required|array',
            'niche' => 'required|string'
        ]);

        $response = Http::post('http://localhost:3001/scrape-maps', [
            'cities' => $validated['cities'],
            'niche' => $validated['niche']
        ]);

        return response()->json($response->json());
    }


    /////////////////////////

    public function scrape(Request $request)
    {
        $request->validate(['url' => 'required|url']);
        $url = $request->input('url');
        $baseUrl = parse_url($url, PHP_URL_SCHEME) . '://' . parse_url($url, PHP_URL_HOST);

        try {
            $client = new Client([
                'timeout' => 15,
                'verify' => false,
                'headers' => [
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
                    'Accept-Language' => 'fr-FR,fr;q=0.9,en;q=0.8',
                ]
            ]);

            $response = $client->get($url);
            $html = (string) $response->getBody();
            $crawler = new Crawler($html, $url);

            $data = [
                'url'         => $url,
                'scraped_at'  => now()->toIso8601String(),
                'meta'        => $this->extractMeta($crawler),
                'texts'       => $this->extractTexts($crawler),
                'images'      => $this->extractImages($crawler, $baseUrl),
                'links'       => $this->extractLinks($crawler, $baseUrl),
                'contact'     => $this->extractContact($html),
                'colors'      => $this->extractColors($html),
            ];

            return response()->json($data);

        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    private function extractMeta(Crawler $crawler): array
    {
        $meta = [];

        try { $meta['title'] = $crawler->filter('title')->first()->text(''); } catch (\Exception $e) {}
        try { $meta['description'] = $crawler->filter('meta[name="description"]')->first()->attr('content'); } catch (\Exception $e) {}
        try { $meta['keywords'] = $crawler->filter('meta[name="keywords"]')->first()->attr('content'); } catch (\Exception $e) {}
        try { $meta['og_title'] = $crawler->filter('meta[property="og:title"]')->first()->attr('content'); } catch (\Exception $e) {}
        try { $meta['og_image'] = $crawler->filter('meta[property="og:image"]')->first()->attr('content'); } catch (\Exception $e) {}
        try { $meta['og_description'] = $crawler->filter('meta[property="og:description"]')->first()->attr('content'); } catch (\Exception $e) {}

        return array_filter($meta);
    }

    private function extractTexts(Crawler $crawler): array
    {
        $texts = [];

        foreach (['h1', 'h2', 'h3', 'h4'] as $tag) {
            $crawler->filter($tag)->each(function (Crawler $node) use (&$texts, $tag) {
                $text = trim($node->text(''));
                if ($text) $texts[$tag][] = $text;
            });
        }

        $crawler->filter('p')->each(function (Crawler $node) use (&$texts) {
            $text = trim($node->text(''));
            if (strlen($text) > 20) $texts['paragraphs'][] = $text;
        });

        $crawler->filter('button, a.btn, .cta, [class*="btn"]')->each(function (Crawler $node) use (&$texts) {
            $text = trim($node->text(''));
            if ($text) $texts['cta'][] = $text;
        });

        $crawler->filter('ul li, ol li')->each(function (Crawler $node) use (&$texts) {
            $text = trim($node->text(''));
            if (strlen($text) > 5) $texts['list_items'][] = $text;
        });

        return $texts;
    }

    private function extractImages(Crawler $crawler, string $baseUrl): array
    {
        $images = [];

        $crawler->filter('img')->each(function (Crawler $node) use (&$images, $baseUrl) {
            $src = $node->attr('src') ?? $node->attr('data-src') ?? '';
            if (!$src) return;

            if (!str_starts_with($src, 'http')) {
                $src = $baseUrl . '/' . ltrim($src, '/');
            }

            $images[] = [
                'src'   => $src,
                'alt'   => $node->attr('alt') ?? '',
                'title' => $node->attr('title') ?? '',
                'width' => $node->attr('width') ?? '',
                'height'=> $node->attr('height') ?? '',
            ];
        });

        return $images;
    }

    private function extractLinks(Crawler $crawler, string $baseUrl): array
    {
        $internal = [];
        $external = [];

        $crawler->filter('a[href]')->each(function (Crawler $node) use (&$internal, &$external, $baseUrl) {
            $href = $node->attr('href');
            $text = trim($node->text(''));

            if (!$href || str_starts_with($href, '#') || str_starts_with($href, 'javascript')) return;

            if (!str_starts_with($href, 'http')) {
                $href = $baseUrl . '/' . ltrim($href, '/');
            }

            $entry = ['url' => $href, 'text' => $text];

            if (str_contains($href, parse_url($baseUrl, PHP_URL_HOST))) {
                $internal[] = $entry;
            } else {
                $external[] = $entry;
            }
        });

        return ['internal' => array_unique($internal, SORT_REGULAR), 'external' => array_unique($external, SORT_REGULAR)];
    }

    private function extractContact(string $html): array
    {
        $contact = [];

        preg_match_all('/(?:\+33|0)[1-9](?:[\s.\-]?\d{2}){4}/', $html, $phones);
        $contact['phones'] = array_unique($phones[0]);

        preg_match_all('/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/', $html, $emails);
        $contact['emails'] = array_unique($emails[0]);

        preg_match_all('/\d{1,4}[\s,]+(?:rue|avenue|boulevard|allée|impasse|chemin)[^<\n]{5,60}/i', $html, $addresses);
        $contact['addresses'] = array_unique($addresses[0]);

        return $contact;
    }

    private function extractColors(string $html): array
    {
        $colors = [];

        preg_match_all('/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/', $html, $hex);
        preg_match_all('/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+.*?\)/', $html, $rgb);

        $colors['hex']  = array_unique($hex[0]);
        $colors['rgb']  = array_unique($rgb[0]);

        return $colors;
    }
}

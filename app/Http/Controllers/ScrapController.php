<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

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
}

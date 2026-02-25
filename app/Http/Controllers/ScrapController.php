<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ScrapController extends Controller
{
    public function step1(Request $request) {

        $validated = $request->validate([
            'number_first_city' => 'required|integer',
            'counter_cities' => 'required|integer',
        ]);

        $success = true;

        return response()->json([
            'success' => $success,
            'message' => $success ? "Réussite" : "Echec",
            'data'    => [$validated],
        ], $success ? 200 : 500);
    }
}

<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ScrapController;

Route::post('/step1', [ScrapController::class, 'step1']);
Route::post('/step2', [ScrapController::class, 'step2']);
Route::post('/step3', [ScrapController::class, 'step3']);

Route::post('/scrape', [ScrapController::class, 'scrape']);

Route::get('/{any}', function () {
    return view('welcome');
})->where('any', '.*');
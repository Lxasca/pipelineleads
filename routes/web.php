<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ScrapController;

Route::post('/step1', [ScrapController::class, 'step1']);

Route::get('/{any}', function () {
    return view('welcome');
})->where('any', '.*');
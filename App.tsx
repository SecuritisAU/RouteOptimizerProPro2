import React, { useState, useCallback, useEffect } from 'react';
import { Stop, OptimizedStop, GeminiOptimizationResponse, RadioStationLink } from './types';
import { generateId } from './utils/helpers';
import { optimizeStopsWithGemini } from './services/geminiService';
import Header from './components/Header';
import Footer from './components/Footer';
import StopInput from './components/StopInput';
import StopList from './components/StopList';
import OptimizedRouteDisplay from './components/OptimizedRouteDisplay';
import LoadingSpinner from './components/LoadingSpinner';
import Alert from './components/Alert';
import FileUpload from './components/FileUpload';
import RadioModal from './components/RadioModal';

type Theme = 'light' | 'dark';

// Sample iHeartRadio Stations
const iHeartRadioStations: RadioStationLink[] = [
  { name: 'Z100 New York', url: 'https://www.iheart.com/live/z100-1469/' },
  { name: 'KIIS FM Los Angeles', url: 'https://www.iheart.com/live/kiis-fm-1027-185/' },
  { name: '103.5 KISS FM Chicago', url: 'https://www.iheart.com/live/1035-kiss-fm-1253/' },
  { name: 'Power 105.1 New York', url: 'https://www.iheart.com/live/power-1051-1465/' },
  { name: 'ALT 98.7 Los Angeles', url: 'https://www.iheart.com/live/alt-987-la-201/' },
];


const App = (): JSX.Element => {
  const [startStop, setStartStop] = useState<Stop | null>(null);
  const [intermediateStops, setIntermediateStops] = useState<Stop[]>([]);
  const [endStop, setEndStop] = useState<Stop | null>(null);
  
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedStop[] | null>(null);
  const [overallRouteMapUrl, setOverallRouteMapUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [startAddressInput, setStartAddressInput] = useState('');
  const [endAddressInput, setEndAddressInput] = useState('');

  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('routeOptimizerTheme') as Theme | null;
    return savedTheme || 'dark'; // Default to dark theme
  });

  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSpeedAvailable, setIsSpeedAvailable] = useState<boolean | undefined>(undefined);
  const [isRadioModalOpen, setIsRadioModalOpen] = useState<boolean>(false);


  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('routeOptimizerTheme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const toggleRadioModal = () => {
    setIsRadioModalOpen(prev => !prev);
  };
  
  useEffect(() => {
    let watchId: number | null = null;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          setLocationError(null);
          if (position.coords.speed !== null && position.coords.speed !== undefined) {
             // speed is in meters/second
            setCurrentSpeedKmh(position.coords.speed * 3.6);
            setIsSpeedAvailable(true);
          } else {
            // Speed data not available from this position update
            setCurrentSpeedKmh(null); // Explicitly set to null if speed is null from a valid position
            setIsSpeedAvailable(false);
          }
        },
        (err) => {
          console.warn(`Geolocation error: ${err.message}`);
          setLocationError(`Location access denied or unavailable. Speed cannot be shown. (Code: ${err.code})`);
          setCurrentSpeedKmh(null);
          setIsSpeedAvailable(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000, // 10 seconds
          maximumAge: 0 // No caching
        }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser. Speed cannot be shown.");
      setIsSpeedAvailable(false);
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);


  const getAllStops = useCallback((): Stop[] => {
    const all = [];
    if (startStop) all.push(startStop);
    all.push(...intermediateStops);
    if (endStop) all.push(endStop);
    return all;
  }, [startStop, intermediateStops, endStop]);

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  }

  const handleAddStartStop = useCallback(() => {
    clearMessages();
    if (startAddressInput.trim() === '') {
      setError("Start address cannot be empty.");
      return;
    }
    if (getAllStops().some(s => s.address.toLowerCase() === startAddressInput.toLowerCase())) {
      setError("This address is already in use as a start, intermediate, or end stop.");
      return;
    }
    setStartStop({ id: generateId(), address: startAddressInput.trim() });
    setStartAddressInput('');
    setOptimizedRoute(null);
    setOverallRouteMapUrl(null);
  }, [startAddressInput, getAllStops]);

  const handleRemoveStartStop = useCallback(() => {
    clearMessages();
    setStartStop(null);
    setOptimizedRoute(null);
    setOverallRouteMapUrl(null);
  }, []);

  const handleAddEndStop = useCallback(() => {
    clearMessages();
    if (endAddressInput.trim() === '') {
      setError("End address cannot be empty.");
      return;
    }
     if (getAllStops().some(s => s.address.toLowerCase() === endAddressInput.toLowerCase())) {
      setError("This address is already in use as a start, intermediate, or end stop.");
      return;
    }
    setEndStop({ id: generateId(), address: endAddressInput.trim() });
    setEndAddressInput('');
    setOptimizedRoute(null);
    setOverallRouteMapUrl(null);
  }, [endAddressInput, getAllStops]);

  const handleRemoveEndStop = useCallback(() => {
    clearMessages();
    setEndStop(null);
    setOptimizedRoute(null);
    setOverallRouteMapUrl(null);
  }, []);

  const handleAddIntermediateStop = useCallback((address: string) => {
    clearMessages();
    if (address.trim() === '') {
      setError("Address cannot be empty.");
      return;
    }
    if (getAllStops().some(s => s.address.toLowerCase() === address.toLowerCase())) {
      setError("This address is already in use as a start, intermediate, or end stop.");
      return;
    }
    const newStop: Stop = { id: generateId(), address };
    setIntermediateStops(prevStops => [...prevStops, newStop]);
    setOptimizedRoute(null);
    setOverallRouteMapUrl(null);
  }, [getAllStops]);

  const handleRemoveIntermediateStop = useCallback((id: string) => {
    clearMessages();
    setIntermediateStops(prevStops => prevStops.filter(stop => stop.id !== id));
    setOptimizedRoute(null);
    setOverallRouteMapUrl(null);
  }, []);

  const handleClearAllStops = useCallback(() => {
    clearMessages();
    setStartStop(null);
    setIntermediateStops([]);
    setEndStop(null);
    setOptimizedRoute(null);
    setOverallRouteMapUrl(null);
    setStartAddressInput('');
    setEndAddressInput('');
  }, []);

  const handleAddressesFromFile = useCallback((newAddresses: string[]) => {
    clearMessages();
    if (newAddresses.length === 0) {
      setError("No valid addresses found in the uploaded file, or the file was empty.");
      return;
    }

    const currentStopAddresses = getAllStops().map(s => s.address.toLowerCase());
    
    const uniqueNewAddresses = newAddresses
      .map(addr => addr.trim())
      .filter(addr => addr !== '')
      .filter((addr, index, self) => self.findIndex(a => a.toLowerCase() === addr.toLowerCase()) === index) 
      .filter(addr => !currentStopAddresses.includes(addr.toLowerCase()));

    if (uniqueNewAddresses.length === 0) {
      if (newAddresses.length > 0) {
        setError("All addresses from the file are already in your list or were duplicates within the file.");
      } else {
         setError("No new addresses to add from the file.");
      }
      return;
    }

    const stopsToAdd: Stop[] = uniqueNewAddresses.map(addr => ({
      id: generateId(),
      address: addr,
    }));

    setIntermediateStops(prevStops => [...prevStops, ...stopsToAdd]);
    setOptimizedRoute(null);
    setOverallRouteMapUrl(null);
    setSuccessMessage(`${stopsToAdd.length} new unique stop(s) added from the file.`);
  }, [getAllStops]);


  const handleOptimizeRoute = useCallback(async () => {
    clearMessages();
    const currentStops = getAllStops();
    
    // This count includes start, intermediate, and end stops.
    const totalStopCountForCheck = (startStop ? 1:0) + intermediateStops.length + (endStop ? 1:0);

    if (totalStopCountForCheck === 0) {
        setError("Please add at least one stop to optimize."); // Or "Please add at least two stops..."
        return;
    }
    // Check if there are enough distinct points for meaningful optimization.
    // e.g. just a start, or just an end, or just one intermediate stop.
    if (totalStopCountForCheck < 2) {
      setError("Please add at least two stops for a meaningful route optimization.");
      return;
    }


    setIsLoading(true);
    setOptimizedRoute(null);
    setOverallRouteMapUrl(null);

    try {
      const response: GeminiOptimizationResponse = await optimizeStopsWithGemini(
        startStop ? startStop.address : null,
        intermediateStops.map(s => s.address),
        endStop ? endStop.address : null
      );

      const newOptimizedStops: OptimizedStop[] = [];
      const allOriginalStops = [startStop, ...intermediateStops, endStop].filter(Boolean) as Stop[];

      for (const geminiStopData of response.optimizedRoute) {
        const originalStop = allOriginalStops.find(s => s.address.toLowerCase() === geminiStopData.address.toLowerCase());
        if (originalStop) {
          newOptimizedStops.push({
            ...originalStop,
            travelTimeToNextStop: geminiStopData.travelTimeToNextStop,
            streetViewUrl: geminiStopData.streetViewUrl,
            isStart: startStop?.id === originalStop.id,
            isEnd: endStop?.id === originalStop.id,
          });
        } else {
          // This case can happen if Gemini modifies an address slightly (e.g. geocoding correction)
          // or adds a stop not explicitly in the input (though the prompt tries to prevent this).
          console.warn("Optimized stop address not found in original stops:", geminiStopData.address);
          newOptimizedStops.push({
            id: generateId(), 
            address: geminiStopData.address,
            travelTimeToNextStop: geminiStopData.travelTimeToNextStop,
            streetViewUrl: geminiStopData.streetViewUrl,
            // Try to infer start/end based on position if not found, though less reliable
            isStart: !startStop && newOptimizedStops.length === 0, 
            isEnd: false, // Difficult to determine 'isEnd' for such stops reliably
          });
        }
      }
      
      // If startStop exists and isn't the first in optimized, or endStop exists and isn't last,
      // it might indicate an issue or a specific optimization choice by Gemini.
      // For now, we trust the order from Gemini.

      setOptimizedRoute(newOptimizedStops);
      setOverallRouteMapUrl(response.overallRouteUrl || null);

      if (newOptimizedStops.length === 0 && currentStops.length > 0) {
         setError("Optimization result was empty. Please check your stops or the API response.");
      } else if (newOptimizedStops.length > 0) {
        setSuccessMessage("Route optimized successfully!");
      }

    } catch (err) {
      console.error("Error optimizing route:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during route optimization.";
      setError(errorMessage);
      setOptimizedRoute(null);
      setOverallRouteMapUrl(null);
    } finally {
      setIsLoading(false);
    }
  }, [startStop, intermediateStops, endStop, getAllStops]);

  const totalStopsCount = (startStop ? 1 : 0) + intermediateStops.length + (endStop ? 1 : 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-sky-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <Header 
        theme={theme} 
        toggleTheme={toggleTheme} 
        currentSpeedKmh={currentSpeedKmh} 
        locationError={locationError}
        isSpeedAvailable={isSpeedAvailable}
        onToggleRadio={toggleRadioModal}
        />
      <main className="flex-grow container mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        <div className="lg:w-2/5 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col">
          <h2 className="text-2xl font-semibold mb-6 text-sky-600 dark:text-sky-400">Manage Delivery Stops</h2>
          
          {error && <Alert message={error} type="error" onClose={clearMessages} duration={10000} />}
          {successMessage && <Alert message={successMessage} type="success" onClose={clearMessages} duration={5000} />}

          {/* Start Stop Input */}
          <div className="mb-4">
            <label htmlFor="start-address" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Start Address (Optional)</label>
            <div className="flex gap-2">
              <input
                id="start-address"
                type="text"
                value={startAddressInput}
                onChange={(e) => setStartAddressInput(e.target.value)}
                placeholder="e.g., Your Depot"
                className="flex-grow bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-3 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                aria-label="Start address"
                disabled={isLoading || !!startStop}
              />
              <button
                type="button"
                onClick={handleAddStartStop}
                disabled={isLoading || !!startStop || !startAddressInput.trim()}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-150 ease-in-out shadow-md focus:outline-none focus-ring-sky disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Set Start
              </button>
            </div>
          </div>

          {/* Intermediate Stop Input */}
          <div className="mb-4">
            <label htmlFor="intermediate-stop-input" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Add Intermediate Stops</label>
            <StopInput onAddStop={handleAddIntermediateStop} disabled={isLoading} />
          </div>
          
          {/* File Upload */}
           <FileUpload 
              onAddressesAdd={handleAddressesFromFile}
              setIsLoading={setIsLoading} 
              setError={setError}
              disabled={isLoading}
            />


          {/* End Stop Input */}
          <div className="mb-6">
            <label htmlFor="end-address" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">End Address (Optional)</label>
            <div className="flex gap-2">
              <input
                id="end-address"
                type="text"
                value={endAddressInput}
                onChange={(e) => setEndAddressInput(e.target.value)}
                placeholder="e.g., Final Destination"
                className="flex-grow bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-3 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                aria-label="End address"
                disabled={isLoading || !!endStop}
              />
              <button
                type="button"
                onClick={handleAddEndStop}
                disabled={isLoading || !!endStop || !endAddressInput.trim()}
                className="bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-150 ease-in-out shadow-md focus:outline-none focus-ring-sky disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Set End
              </button>
            </div>
          </div>
          
          <hr className="my-3 border-slate-200 dark:border-slate-700"/>

          {/* Stop List */}
          <div className="flex-grow overflow-y-auto pr-1 styled-scrollbar-dark dark:styled-scrollbar-dark">
            <StopList
              startStop={startStop}
              intermediateStops={intermediateStops}
              endStop={endStop}
              onRemoveStartStop={handleRemoveStartStop}
              onRemoveIntermediateStop={handleRemoveIntermediateStop}
              onRemoveEndStop={handleRemoveEndStop}
              disabled={isLoading}
            />
          </div>
            
          {totalStopsCount > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={handleClearAllStops}
                disabled={isLoading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-150 ease-in-out shadow-md focus:outline-none focus-ring-sky flex items-center justify-center text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0c1.153 0 2.243.032 3.223.094M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Clear All Stops
              </button>
            </div>
          )}
        </div>

        <div className="lg:w-3/5 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col">
          <h2 className="text-2xl font-semibold mb-2 text-sky-600 dark:text-sky-400">Optimized Route</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Click "Optimize Route" after adding your stops. The optimized path will appear below.
          </p>
          <button
            onClick={handleOptimizeRoute}
            disabled={isLoading || totalStopsCount < 2 } // Meaningful optimization requires at least 2 stops.
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-150 ease-in-out shadow-xl focus:outline-none focus-ring-sky text-lg mb-6 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" /> 
                <span className="ml-2">Optimizing...</span>
              </>
            ) : (
              <>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L1.875 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.125 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.25 12a6.25 6.25 0 11-12.5 0 6.25 6.25 0 0112.5 0z" />
              </svg>
              Optimize Route
              </>
            )}
          </button>
          
          {isLoading && !optimizedRoute && (
            <div className="flex-grow flex items-center justify-center">
              <LoadingSpinner text="Calculating the best path for you..." size="lg" />
            </div>
          )}

          {!isLoading && optimizedRoute && (
            <OptimizedRouteDisplay stops={optimizedRoute} overallRouteMapUrl={overallRouteMapUrl} theme={theme} />
          )}
          {!isLoading && !optimizedRoute && !error && (
             <div className="flex-grow flex items-center justify-center">
                <div className="text-center text-slate-500 dark:text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mx-auto mb-4 opacity-50">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m0 0l-3.75-3.75M9 15l3.75-3.75M15 19.5a3 3 0 11-6 0 3 3 0 016 0zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                     <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L16.5 9.75l-3-3.75 3-1.5zM4.5 12.75l-3 3 1.5 3 3-1.5-1.5-3z" /> {/* Simple decoration for route icon */}
                  </svg>
                  <p className="text-lg">Your optimized route will appear here.</p>
                  <p className="text-sm">Add some stops and click "Optimize Route".</p>
                </div>
              </div>
          )}
        </div>
      </main>
      <Footer />
      {isRadioModalOpen && (
        <RadioModal
          isOpen={isRadioModalOpen}
          onClose={toggleRadioModal}
          stations={iHeartRadioStations}
          theme={theme}
        />
      )}
    </div>
  );
};

export default App;
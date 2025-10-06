import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { 
  Camera, 
  Flashlight, 
  
  X, 
  Search, 
  Package, 
  BarChart3, 
  MapPin, 
  Plus,
  Keyboard,
  Image as ImageIcon,
  History,
  AlertCircle,
  CheckCircle,
  Loader2,
  Scan
} from 'lucide-react';

// Interfaces for API responses
interface ProductVariant {
  id: string;
  product_id: string;
  brand: string | null;
  grade: string | null;
  size: string | null;
  pack_quantity: number | null;
  pack_unit: string | null;
  barcode: string | null;
  image_url: string | null;
  product?: {
    canonical_name: string;
    base_unit: string;
    category_id: string;
  };
}

interface SearchResponse {
  variants: ProductVariant[];
  total: number;
}

interface InventoryItem {
  shop_id: string;
  variant_id: string;
  in_stock: boolean;
  stock_quantity: number | null;
  shop: {
    id: string;
    name: string;
    location_lat: number;
    location_lng: number;
    verified: boolean;
    rating_average: number;
  };
  price?: number;
}

interface InventoryResponse {
  inventory: InventoryItem[];
  total: number;
}

// Component state interfaces
interface CameraState {
  active: boolean;
  permission_granted: boolean;
  flash_enabled: boolean;
  auto_focus: boolean;
  scanning: boolean;
}

interface ScanResult {
  barcode: string | null;
  format: string | null;
  product_match: ProductVariant | null;
  confidence: number;
}

interface ProductRecognition {
  matched_variants: ProductVariant[];
  alternative_suggestions: ProductVariant[];
  manual_association_needed: boolean;
  shop_availability?: {
    shop: InventoryItem['shop'];
    in_stock: boolean;
    stock_quantity: number | null;
    price?: number;
  }[];
}

interface AutoAddToBOM {
  enabled: boolean;
  quantity: number;
  unit: string;
}

interface ScanHistoryItem {
  barcode: string;
  scanned_at: number;
  product_name: string | null;
  action_taken: string;
}

interface ManualEntryMode {
  active: boolean;
  barcode_input: string;
  entry_method: string;
}

interface GalleryImportState {
  importing: boolean;
  selected_image: string | null;
  processing: boolean;
}

const UV_BarcodeScanner: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // URL params
  const addToBOMParam = searchParams.get('add_to_bom') === 'true';

  // Global state
  // const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const currentBOM = useAppStore(state => state.current_bom);
  // const userLocation = useAppStore(state => state.user_location);
  const addBomItem = useAppStore(state => state.add_bom_item);

  // Local state
  const [cameraState, setCameraState] = useState<CameraState>({
    active: false,
    permission_granted: false,
    flash_enabled: false,
    auto_focus: true,
    scanning: false
  });

  const [scanResults, setScanResults] = useState<ScanResult>({
    barcode: null,
    format: null,
    product_match: null,
    confidence: 0
  });

  const [productRecognition, setProductRecognition] = useState<ProductRecognition>({
    matched_variants: [],
    alternative_suggestions: [],
    manual_association_needed: false
  });

  const [autoAddToBOM, setAutoAddToBOM] = useState<AutoAddToBOM>({
    enabled: addToBOMParam,
    quantity: 1,
    unit: 'piece'
  });

  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [manualEntryMode, setManualEntryMode] = useState<ManualEntryMode>({
    active: false,
    barcode_input: '',
    entry_method: 'keyboard'
  });

  const [galleryImportState, setGalleryImportState] = useState<GalleryImportState>({
    importing: false,
    selected_image: null,
    processing: false
  });

  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);

  // Initialize camera
  const initializeCamera = useCallback(async () => {
    setCameraState(prev => ({ ...prev, scanning: true }));
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCurrentStream(stream);
        setCameraState(prev => ({
          ...prev,
          active: true,
          permission_granted: true,
          scanning: false
        }));
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraState(prev => ({
        ...prev,
        active: false,
        permission_granted: false,
        scanning: false
      }));
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      setCurrentStream(null);
    }
    setCameraState(prev => ({
      ...prev,
      active: false,
      scanning: false
    }));
  }, [currentStream]);

  // Simulate barcode detection (in real implementation would use barcode detection library)
  const simulateBarcodeDetection = useCallback(() => {
    if (!cameraState.active || cameraState.scanning) return;

    // Simulate barcode detection every 2 seconds
    const mockBarcodes = [
      '1234567890123',
      '9876543210987',
      '5555555555555',
      '1111111111111'
    ];

    const randomBarcode = mockBarcodes[Math.floor(Math.random() * mockBarcodes.length)];
    
    setScanResults({
      barcode: randomBarcode,
      format: 'EAN-13',
      product_match: null,
      confidence: 0.95
    });

    // Trigger product search
    processBarcodeResult(randomBarcode);
  }, [cameraState.active, cameraState.scanning]);

  // Search for products by barcode
  const { data: barcodeSearchData, isLoading: isSearchingBarcode, refetch: searchByBarcode } = useQuery({
    queryKey: ['product-variants-barcode', scanResults.barcode],
    queryFn: async (): Promise<SearchResponse> => {
      if (!scanResults.barcode) throw new Error('No barcode to search');
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/product-variants`,
        {
          params: {
            query: scanResults.barcode,
            is_active: true,
            limit: 10
          }
        }
      );
      return response.data;
    },
    enabled: false,
    staleTime: 60000,
    retry: 1
  });

  // Extended product search
  const { data: extendedSearchData, isLoading: isExtendedSearching, refetch: searchExtended } = useQuery({
    queryKey: ['search-products', scanResults.barcode],
    queryFn: async (): Promise<{ results: { products: ProductVariant[] } }> => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/search`,
        {
          params: {
            q: scanResults.barcode,
            type: 'products',
            limit: 20
          }
        }
      );
      return response.data;
    },
    enabled: false,
    staleTime: 60000,
    retry: 1
  });

  // Check shop inventory
  const { data: inventoryData, isLoading: isCheckingInventory, refetch: checkInventory } = useQuery({
    queryKey: ['inventory-check', productRecognition.matched_variants[0]?.id],
    queryFn: async (): Promise<InventoryResponse> => {
      const variantId = productRecognition.matched_variants[0]?.id;
      if (!variantId) throw new Error('No variant to check');
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/inventory`,
        {
          params: {
            variant_id: variantId,
            in_stock: true,
            limit: 10
          }
        }
      );
      return response.data;
    },
    enabled: false,
    staleTime: 30000,
    retry: 1
  });

  // Add to BOM mutation
  const addToBOMMutation = useMutation({
    mutationFn: async (data: { variant_id: string; quantity: number; unit: string; notes: string }) => {
      if (!currentBOM.id || !authToken) {
        throw new Error('BOM or authentication required');
      }

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/boms/${currentBOM.id}/items`,
        {
          variant_id: data.variant_id,
          quantity: data.quantity,
          unit: data.unit,
          waste_factor: 0,
          notes: data.notes
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Update global BOM state
      addBomItem({
        variant_id: data.variant_id,
        quantity: data.quantity,
        unit: data.unit,
        notes: data.notes
      });

      // Update scan history
      setScanHistory(prev => [
        ...prev,
        {
          barcode: scanResults.barcode || '',
          scanned_at: Date.now(),
          product_name: productRecognition.matched_variants[0]?.product?.canonical_name || null,
          action_taken: 'added_to_bom'
        }
      ]);
    }
  });

  // Process barcode result
  const processBarcodeResult = useCallback(async (barcode: string) => {
    setScanResults(prev => ({ ...prev, barcode }));
    setCameraState(prev => ({ ...prev, scanning: true }));
    
    try {
      await searchByBarcode();
    } catch (error) {
      console.error('Barcode search error:', error);
      await searchExtended();
    }
  }, [searchByBarcode, searchExtended]);

  // Handle barcode search results
  useEffect(() => {
    if (barcodeSearchData) {
      const exactMatches = barcodeSearchData.variants.filter(v => v.barcode === scanResults.barcode);
      const suggestions = barcodeSearchData.variants.filter(v => v.barcode !== scanResults.barcode);

      setProductRecognition({
        matched_variants: exactMatches,
        alternative_suggestions: suggestions,
        manual_association_needed: exactMatches.length === 0
      });

      setScanResults(prev => ({
        ...prev,
        product_match: exactMatches[0] || null,
        confidence: exactMatches.length > 0 ? 1.0 : 0.0
      }));

      setCameraState(prev => ({ ...prev, scanning: false }));

      // Auto-add to BOM if enabled and match found
      if (autoAddToBOM.enabled && exactMatches.length > 0 && currentBOM.id) {
        handleAddToBOM(exactMatches[0]);
      }
    }
  }, [barcodeSearchData, scanResults.barcode, autoAddToBOM.enabled, currentBOM.id]);

  // Handle extended search results
  useEffect(() => {
    if (extendedSearchData) {
      setProductRecognition(prev => ({
        ...prev,
        alternative_suggestions: extendedSearchData.results.products || []
      }));
      setCameraState(prev => ({ ...prev, scanning: false }));
    }
  }, [extendedSearchData]);

  // Handle inventory results
  useEffect(() => {
    if (inventoryData) {
      setProductRecognition(prev => ({
        ...prev,
        shop_availability: inventoryData.inventory.map(inv => ({
          shop: inv.shop,
          in_stock: inv.in_stock,
          stock_quantity: inv.stock_quantity,
          price: inv.price
        }))
      }));
    }
  }, [inventoryData]);

  // Initialize camera on mount
  useEffect(() => {
    initializeCamera();
    return () => stopCamera();
  }, [initializeCamera, stopCamera]);

  // Simulate barcode detection
  useEffect(() => {
    if (cameraState.active && !manualEntryMode.active) {
      const interval = setInterval(() => {
        if (Math.random() > 0.7) { // 30% chance of detection every 3 seconds
          simulateBarcodeDetection();
        }
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [cameraState.active, manualEntryMode.active, simulateBarcodeDetection]);

  // Handle manual barcode entry
  const handleManualEntry = useCallback(async () => {
    if (!manualEntryMode.barcode_input.trim()) return;
    
    await processBarcodeResult(manualEntryMode.barcode_input.trim());
    setManualEntryMode(prev => ({ ...prev, active: false, barcode_input: '' }));
  }, [manualEntryMode.barcode_input, processBarcodeResult]);

  // Handle add to BOM
  const handleAddToBOM = useCallback(async (variant: ProductVariant) => {
    if (!currentBOM.id || !authToken) {
      navigate('/bom');
      return;
    }

    try {
      await addToBOMMutation.mutateAsync({
        variant_id: variant.id,
        quantity: autoAddToBOM.quantity,
        unit: autoAddToBOM.unit,
        notes: 'Added via barcode scan'
      });
    } catch (error) {
      console.error('Add to BOM error:', error);
    }
  }, [currentBOM.id, authToken, autoAddToBOM, addToBOMMutation, navigate]);

  // Handle price comparison
  const handlePriceComparison = useCallback(() => {
    const variant = productRecognition.matched_variants[0];
    if (variant) {
      navigate(`/compare?product_ids=${variant.product_id}&quantity=${autoAddToBOM.quantity}`);
    }
  }, [productRecognition.matched_variants, autoAddToBOM.quantity, navigate]);

  // Toggle flash
  const toggleFlash = useCallback(() => {
    setCameraState(prev => ({ ...prev, flash_enabled: !prev.flash_enabled }));
  }, []);

  return (
    <>
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Link 
                  to="/search"
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </Link>
                <h1 className="text-lg font-semibold">Barcode Scanner</h1>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleFlash}
                  className={`p-2 rounded-lg transition-colors ${
                    cameraState.flash_enabled 
                      ? 'bg-yellow-600 hover:bg-yellow-700' 
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {cameraState.flash_enabled ? <Flashlight className="w-5 h-5" /> : <Flashlight className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setManualEntryMode(prev => ({ ...prev, active: !prev.active }))}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <Keyboard className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Camera View */}
        <div className="relative aspect-[4/3] bg-black">
          {cameraState.permission_granted ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas
                ref={canvasRef}
                className="hidden"
              />
              
              {/* Scanning overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  {/* Scanning frame */}
                  <div className="w-64 h-48 border-2 border-white border-opacity-50 rounded-lg relative">
                    {/* Corner guides */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
                    
                    {/* Scanning line */}
                    {cameraState.scanning && (
                      <div className="absolute inset-x-0 top-1/2 h-0.5 bg-blue-500 animate-pulse"></div>
                    )}
                  </div>
                  
                  {/* Instructions */}
                  <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 text-center">
                    <p className="text-white text-sm opacity-80">
                      {cameraState.scanning ? 'Scanning...' : 'Position barcode within frame'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Scan result indicator */}
              {scanResults.barcode && (
                <div className="absolute top-4 left-4 right-4">
                  <div className="bg-black bg-opacity-70 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <Scan className="w-5 h-5 text-green-400" />
                      <span className="text-sm font-medium">Detected: {scanResults.barcode}</span>
                      {isSearchingBarcode || isExtendedSearching ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">Camera Access Required</h3>
                <p className="text-gray-400 mb-4">Enable camera access to scan barcodes</p>
                <button
                  onClick={initializeCamera}
                  className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Enable Camera
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Manual Entry Modal */}
        {manualEntryMode.active && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 m-4 w-full max-w-sm">
              <h3 className="text-lg font-semibold mb-4">Enter Barcode Manually</h3>
              <input
                type="text"
                value={manualEntryMode.barcode_input}
                onChange={(e) => setManualEntryMode(prev => ({ ...prev, barcode_input: e.target.value }))}
                placeholder="Enter barcode number"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              <div className="flex space-x-3 mt-4">
                <button
                  onClick={handleManualEntry}
                  disabled={!manualEntryMode.barcode_input.trim() || isSearchingBarcode}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {isSearchingBarcode ? 'Searching...' : 'Search'}
                </button>
                <button
                  onClick={() => setManualEntryMode(prev => ({ ...prev, active: false, barcode_input: '' }))}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        <div className="flex-1 bg-white text-gray-900">
          {/* Auto Add to BOM Toggle */}
          {currentBOM.id && (
            <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Auto-add to BOM: {currentBOM.title}</span>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={autoAddToBOM.enabled}
                    onChange={(e) => setAutoAddToBOM(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>
              {autoAddToBOM.enabled && (
                <div className="flex items-center space-x-3 mt-2">
                  <input
                    type="number"
                    value={autoAddToBOM.quantity}
                    onChange={(e) => setAutoAddToBOM(prev => ({ ...prev, quantity: Math.max(1, Number(e.target.value)) }))}
                    min="1"
                    className="w-20 px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={autoAddToBOM.unit}
                    onChange={(e) => setAutoAddToBOM(prev => ({ ...prev, unit: e.target.value }))}
                    className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="piece">Piece</option>
                    <option value="kg">Kg</option>
                    <option value="meter">Meter</option>
                    <option value="liter">Liter</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Product Results */}
          {(productRecognition.matched_variants.length > 0 || productRecognition.alternative_suggestions.length > 0) && (
            <div className="p-4">
              {/* Exact Matches */}
              {productRecognition.matched_variants.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    Product Found
                  </h3>
                  {productRecognition.matched_variants.map((variant) => (
                    <div key={variant.id} className="bg-gray-50 rounded-lg p-4 border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-lg">{variant.product?.canonical_name}</h4>
                          {variant.brand && (
                            <p className="text-gray-600">Brand: {variant.brand}</p>
                          )}
                          {variant.size && (
                            <p className="text-gray-600">Size: {variant.size}</p>
                          )}
                          <p className="text-sm text-gray-500 mt-1">Barcode: {variant.barcode}</p>
                        </div>
                        {variant.image_url && (
                          <img 
                            src={variant.image_url} 
                            alt={variant.product?.canonical_name}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Link
                          to={`/product/${variant.product_id}?quantity=${autoAddToBOM.quantity}`}
                          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          <Search className="w-4 h-4" />
                          <span>View Details</span>
                        </Link>
                        
                        <button
                          onClick={handlePriceComparison}
                          className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          <BarChart3 className="w-4 h-4" />
                          <span>Compare Prices</span>
                        </button>
                        
                        <button
                          onClick={() => checkInventory()}
                          disabled={isCheckingInventory}
                          className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          <MapPin className="w-4 h-4" />
                          <span>Check Availability</span>
                        </button>
                        
                        {currentBOM.id && !autoAddToBOM.enabled && (
                          <button
                            onClick={() => handleAddToBOM(variant)}
                            disabled={addToBOMMutation.isPending}
                            className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add to BOM</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Shop Availability */}
              {productRecognition.shop_availability && productRecognition.shop_availability.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Nearby Availability</h3>
                  <div className="space-y-2">
                    {productRecognition.shop_availability.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{item.shop.name}</p>
                          <p className="text-sm text-gray-600">
                            {item.in_stock ? (
                              <span className="text-green-600">In Stock</span>
                            ) : (
                              <span className="text-red-600">Out of Stock</span>
                            )}
                            {item.stock_quantity && ` (${item.stock_quantity} available)`}
                          </p>
                        </div>
                        {item.price && (
                          <div className="text-right">
                            <p className="font-semibold">AED {item.price.toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alternative Suggestions */}
              {productRecognition.alternative_suggestions.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center">
                    <AlertCircle className="w-5 h-5 text-orange-600 mr-2" />
                    Similar Products
                  </h3>
                  <div className="space-y-3">
                    {productRecognition.alternative_suggestions.slice(0, 3).map((variant) => (
                      <div key={variant.id} className="bg-gray-50 rounded-lg p-3 border">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{variant.product?.canonical_name}</h4>
                            {variant.brand && (
                              <p className="text-sm text-gray-600">Brand: {variant.brand}</p>
                            )}
                          </div>
                          <Link
                            to={`/product/${variant.product_id}`}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            View →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No Results */}
          {scanResults.barcode && !isSearchingBarcode && !isExtendedSearching && 
           productRecognition.matched_variants.length === 0 && 
           productRecognition.alternative_suggestions.length === 0 && (
            <div className="p-4">
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Product Not Found</h3>
                <p className="text-gray-500 mb-4">No products found for barcode: {scanResults.barcode}</p>
                <Link
                  to={`/search?q=${scanResults.barcode}`}
                  className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <Search className="w-4 h-4" />
                  <span>Search Manually</span>
                </Link>
              </div>
            </div>
          )}

          {/* Scan History */}
          {scanHistory.length > 0 && (
            <div className="border-t border-gray-200 p-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <History className="w-5 h-5 mr-2" />
                Recent Scans
              </h3>
              <div className="space-y-2">
                {scanHistory.slice(-3).reverse().map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-sm">{item.product_name || item.barcode}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(item.scanned_at).toLocaleTimeString()} • {item.action_taken}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_BarcodeScanner;
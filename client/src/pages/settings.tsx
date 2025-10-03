import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Plus, Trash2, Key, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ApiKey } from "@shared/schema";
import { format } from "date-fns";

export default function Settings() {
  const { toast } = useToast();
  const { isConnected } = useWebSocket();
  const [newKeyName, setNewKeyName] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: apiKeys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ['/api/keys'],
  });

  const createKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest('POST', '/api/keys', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/keys'] });
      setNewKeyName("");
      toast({
        title: "API Key Created",
        description: "Your new API key has been generated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive",
      });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/keys'] });
      toast({
        title: "API Key Deleted",
        description: "The API key has been deactivated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({
      title: "Copied!",
      description: "API key copied to clipboard",
    });
  };

  const baseUrl = window.location.origin;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar isConnected={isConnected} />
      
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your fleet tracking system configuration
            </p>
          </div>

          <Tabs defaultValue="integration" className="space-y-6">
            <TabsList>
              <TabsTrigger value="integration" data-testid="tab-integration">
                <Key className="w-4 h-4 mr-2" />
                Integration
              </TabsTrigger>
            </TabsList>

            <TabsContent value="integration" className="space-y-6">
              {/* API Documentation */}
              <Card>
                <CardHeader>
                  <CardTitle>OBD Device Configuration</CardTitle>
                  <CardDescription>
                    Configure your cellular/WiFi OBD devices to send data to this system
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">API Base URL</h3>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-4 py-2 bg-muted rounded-md text-sm font-mono">
                        {baseUrl}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(baseUrl)}
                        data-testid="button-copy-base-url"
                      >
                        {copiedKey === baseUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Endpoints</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded text-xs font-semibold">POST</span>
                          <code className="text-sm font-mono">/api/obd/location</code>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">Send GPS location data</p>
                        <pre className="p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto">
{`{
  "vehicleId": "your-vehicle-id",
  "latitude": 40.7485,
  "longitude": -73.9883,
  "speed": 65,
  "heading": 90,
  "altitude": 100,
  "accuracy": 5
}`}
                        </pre>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded text-xs font-semibold">POST</span>
                          <code className="text-sm font-mono">/api/obd/data</code>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">Send diagnostic data</p>
                        <pre className="p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto">
{`{
  "vehicleId": "your-vehicle-id",
  "rpm": 2500,
  "speed": 65,
  "coolantTemp": 195,
  "fuelLevel": 75,
  "engineLoad": 45,
  "throttlePosition": 30,
  "batteryVoltage": 13.8
}`}
                        </pre>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Authentication</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      All OBD device requests must include an API key in the header:
                    </p>
                    <pre className="p-3 bg-muted rounded-md text-xs font-mono">
                      X-API-Key: your-api-key-here
                    </pre>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Configuration Steps</h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                      <li>Generate an API key below</li>
                      <li>Log into your OBD device's admin portal</li>
                      <li>Find the "Webhook" or "API Integration" settings</li>
                      <li>Enter the base URL and endpoints above</li>
                      <li>Add the API key to the request headers</li>
                      <li>Configure the vehicle ID for each device</li>
                      <li>Set the data transmission interval (recommended: 30-60 seconds)</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              {/* API Key Management */}
              <Card>
                <CardHeader>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>
                    Create and manage API keys for your OBD devices
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label htmlFor="key-name" className="sr-only">Key Name</Label>
                      <Input
                        id="key-name"
                        placeholder="Key name (e.g., 'Fleet Tracker Devices')"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        data-testid="input-key-name"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        if (newKeyName.trim()) {
                          createKeyMutation.mutate(newKeyName);
                        }
                      }}
                      disabled={!newKeyName.trim() || createKeyMutation.isPending}
                      data-testid="button-create-key"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Generate Key
                    </Button>
                  </div>

                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                  ) : apiKeys.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No API keys yet. Create one to get started.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {apiKeys.filter(k => k.isActive).map((key) => (
                        <div
                          key={key.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                          data-testid={`api-key-${key.id}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium">{key.name}</p>
                              <span className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded text-xs font-semibold">
                                Active
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono text-muted-foreground">
                                {key.key}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(key.key)}
                                data-testid={`button-copy-${key.id}`}
                              >
                                {copiedKey === key.key ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                            {key.lastUsedAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Last used: {format(new Date(key.lastUsedAt), 'PPp')}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteKeyMutation.mutate(key.id)}
                            disabled={deleteKeyMutation.isPending}
                            data-testid={`button-delete-${key.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

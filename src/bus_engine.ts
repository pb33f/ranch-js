import {Client, IPublishParams, IFrame} from "@stomp/stompjs";
import {RanchUtils} from "./utils.js";
import {Bus, BusCallback, Channel, RanchConfig, StompError, Subscriber, Subscription} from "./bus.js";

const ERROR_CHANNEL_NAME = 'errors';
const DEFAULT_ERROR_MESSAGE = 'An error occurred while communicating with the server';

export class ranch implements Bus {
    private _channels: Channel[] = []
    private _stompClient: Client | undefined = undefined;
    private _preMappedChannels: Map<string, string>
    private _activeMappings: Map<string, string>
    private _brokerSubscriptions: Map<string, { unsubscribe(): void }>

    constructor() {
        this._preMappedChannels = new Map<string, string>()
        this._activeMappings = new Map<string, string>()
        this._brokerSubscriptions = new Map<string, { unsubscribe(): void }>()
    }

    /**
     * Extracts error information from a STOMP ERROR frame
     * @param frame The STOMP ERROR frame received from the server
     * @returns Structured error information
     */
    private _extractStompError(frame: IFrame): StompError {
        // Extract message from frame body or headers
        let message = DEFAULT_ERROR_MESSAGE;
        
        // Check frame body first
        if (frame.body && frame.body.trim()) {
            message = frame.body.trim();
        } 
        // Fallback to 'message' header
        else if (frame.headers && frame.headers['message']) {
            message = frame.headers['message'];
        }
        
        return {
            frame,
            message,
            details: frame.headers?.['details'],
            code: frame.headers?.['code'] || frame.headers?.['error-code'],
            timestamp: new Date()
        };
    }

    getClient(): Client | undefined {
        return this._stompClient
    }

    get channels(): Channel[] {
        return this._channels
    }

    createChannel(channelName: string): Channel {
        const chan = new channel(channelName)
        this._channels.push(chan)
        return chan
    }

    getChannel(channelName: string): Channel {
        const idx = this._channels.findIndex(c => c.name === channelName)
        if (idx > -1) {
            return this._channels[idx]
        } else {
            return this.createChannel(channelName)
        }
    }

    connectToBroker(config: RanchConfig) {
        if (this._stompClient?.active) {
            return
        }

        const onConnect = config.onConnect;
        const onDisconnect = config.onDisconnect;
        const onWebSocketClose = config.onWebSocketClose;
        const onStompError = config.onStompError;

        this._stompClient = new Client({
            ...config,
            onConnect: (frame) => {
                if (config.mapChannelsOnConnect !== false) {
                    this.mapChannels();
                }
                if (onConnect) {
                    onConnect(frame);
                }
            },
            onDisconnect: (frame) => {
                console.warn('Disconnected from the ranch')
                if (onDisconnect) {
                    onDisconnect(frame);
                }
            },
            onWebSocketClose: (frame: any) => {
                this._brokerSubscriptions.clear()
                console.warn('Socket connection to the ranch was closed, reconnecting...')
                if (onWebSocketClose) {
                    onWebSocketClose(frame);
                } else if (onDisconnect) {
                    onDisconnect(frame);
                }
            },
            onStompError: (frame: IFrame) => {
                const stompError = this._extractStompError(frame);

                // Log error to console
                console.error('STOMP Error received:', stompError.message, stompError);
                this.disableReconnection();

                // Publish to error channel for centralized error handling
                const errorChannel = this.getChannel(ERROR_CHANNEL_NAME);
                errorChannel.publish({
                    command: 'STOMP_ERROR',
                    payload: stompError
                });

                // Call user-defined enhanced error callback if provided
                if (config.onRanchStompError) {
                    config.onRanchStompError(stompError);
                }

                // Also call base STOMP error handler if provided
                if (onStompError) {
                    onStompError(frame);
                }
            }
        })
        this._stompClient.activate()
    }

    mapChannels() {
        // Re-map existing active destinations (lost on reconnection)
        this._activeMappings.forEach((channel: string, destination: string) => {
            this._mapDestination(destination, channel, false)
        });
        
        // Map queued destinations
        this._preMappedChannels.forEach((channel: string, destination: string) => {
            this._mapDestination(destination, channel)
        });
        this._preMappedChannels.clear()
    }

    mapChannelToBrokerDestination(destination: string, channel: string) {
        if (!this._stompClient || !this._stompClient.connected) {
            this._preMappedChannels.set(destination, channel)
        } else {
            this._mapDestination(destination, channel)
        }
    }

    publish(params: IPublishParams): void {
        if (this._stompClient) {
            this._stompClient.publish(params)
        }
    }

    disableReconnection(): void {
        if (this._stompClient) {
            this._stompClient.reconnectDelay = 0
            this._stompClient.maxReconnectDelay = 0
        }
    }

    private _mapDestination(destination: string, channel: string, persistMapping: boolean = true) {
        if (this._stompClient?.connected) {
            this._brokerSubscriptions.get(destination)?.unsubscribe()
            const subscription = this._stompClient.subscribe(destination, message => {
                const chan = this._channels.find(c => c.name === channel)
                if (chan) {
                    chan.publish({payload: JSON.parse(message.body)})
                }
            });
            this._brokerSubscriptions.set(destination, subscription)
            
            // Track successful mapping for reconnection
            if (persistMapping) {
                this._activeMappings.set(destination, channel)
            }
        }
    }
}

class channel implements Channel {
    private subscribers: Subscriber[] = []
    private readonly _name: string

    constructor(channelName: string) {
        this._name = channelName
    }

    get name(): string {
        return this._name
    }

    subscribe(callback: BusCallback): Subscription {
        const subscriber: Subscriber = {
            name: RanchUtils.genUUID(),
            callback: callback
        }
        this.subscribers.push(subscriber)
        return {
            unsubscribe: () => {
                this.subscribers =
                    this.subscribers.filter((s: Subscriber) => s.name !== subscriber.name)
            }
        }
    }

    publish(message: any): void {
        this.subscribers.forEach((s: Subscriber) => s.callback(message))
    }
}

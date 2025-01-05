import {Client, IPublishParams, StompConfig} from "@stomp/stompjs";
import {RanchUtils} from "./utils.ts";
import {Bus, BusCallback, Channel, Subscriber, Subscription} from "./bus.ts";

export class ranch implements Bus {
    private _channels: Channel[] = []
    private _stompClient: Client | undefined  = undefined;
    private _preMappedChannels: Map<string, string>
    constructor() {
        this._preMappedChannels = new Map<string, string>()
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

    connectToBroker(config: StompConfig) {
        this._stompClient = new Client(config)
        this._stompClient.activate()
        this._stompClient.onConnect = (frame) => {
            this._preMappedChannels.forEach((channel: string, destination: string) => {
                this._mapDestination(destination, channel)
            });
            if (config.onConnect) {
                config.onConnect(frame);
            }
        }
        this._stompClient.onDisconnect = (frame) => {
            console.warn('Disconnected from the ranch')
            if (config.onDisconnect) {
                config.onDisconnect(frame);
            }
        }
        this._stompClient.onWebSocketClose = ((frame: any) => {
            console.warn('Socket connection to the ranch was closed, reconnecting...')
            if (config.onDisconnect) {
                config.onDisconnect(frame);
            }
        })
        this._stompClient.activate()
    }

    private _mapDestination(destination: string, channel: string) {
        if (this._stompClient) {
            this._stompClient.subscribe(destination, message => {
                const chan = this._channels.find(c => c.name === channel)
                if (chan) {
                    chan.publish({payload: JSON.parse(message.body)})
                }
            });
        }
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

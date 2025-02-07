import {Client, IPublishParams, StompConfig} from "@stomp/stompjs";
import {ranch} from "./bus_engine.js";

/**
 * A callback for a message received on a channel
 */
export type BusCallback<T = any> = (message: Message<T>) => void

/**
 * A subscription to a channel
 */
export interface Subscription {
    /**
     * unsubscribe will remove the subscription from the channel
     */
    unsubscribe(): void
}

/**
 * A subscriber to a channel
 */
export interface Subscriber {

    /**
     * name of the subscriber
     */
    name: string

    /**
     * callback to be called when a message is received
     */
    callback: BusCallback
}

/**
 * Message is what is sent over each channel, it wraps a payload, ID and command.
 */
export interface Message<T = any> {
    id?: string
    command?: string
    payload?: T
}

/**
 * Channel has two methods, publish and subscribe. Subscriptions return a Subscription
 * and require a BusCallback.
 */
export interface Channel {
    name: string

    /**
     * Subscribe to the channel with a callback for every message
     * @param callback
     */
    subscribe(callback: BusCallback): Subscription

    /**
     * Publish a Message to this channel for all subscribers.
     * @param message
     */
    publish(message: Message): void
}

export class RanchConfig extends StompConfig {
    public mapChannelsOnConnect?: boolean = true;
}

/**
 * Bus is the core event bus of the ranch. It extends across the UI and the backend.
 */
export interface Bus {

    /**
     * Available channels
     */
    channels: Channel[]

    /**
     * Create a new channel on the bus with a channel name. Returns a Channel
     * @param channelName
     */
    createChannel(channelName: string): Channel

    /**
     * Get a Channel from the bus using its string name.
     * @param channelName
     */
    getChannel(channelName: string): Channel

    /**
     * Connect to a ranch compatible broker (ranch talks STOMP).
     * @param config the configuration for the ranch broker.
     *
     */
    connectToBroker(config: RanchConfig): void;

    /**
     * Map a Channel to a destination on the ranch broker. This creates a 'fusion' between the destination
     * on the broker, and the local event bus. It then allows subscriptions of messages on local channels.
     *
     * @param destination the full destination of the topic/queue on the broker.
     * @param channel the name of the channel on the bus to map to the desintation.
     */
    mapChannelToBrokerDestination(destination: string, channel: string): void

    /**
     * Return the STOMP client used under the covers.
     */
    getClient(): Client | undefined

    /**
     * Publish something
     * @param params
     */
    publish(params: IPublishParams): void

    /**
     * Manually map channels, if turned off in RanchConfig.
     */
    mapChannels(): void;
}

export interface CommandResponse<T = any> {
    channel: string;
    payload: T;
}

let _busSingleton: Bus
export function CreateBus(): Bus {
    if (!_busSingleton) {
        _busSingleton = new ranch()
    }
    return _busSingleton
}

export function GetBus(): Bus {
    return CreateBus()
}


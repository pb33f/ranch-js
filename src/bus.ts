import {Client, StompConfig} from "@stomp/stompjs";

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

export interface Message<T = any> {
    id?: string
    command?: string
    payload?: T
}

export interface Channel {
    name: string
    subscribe(callback: BusCallback): Subscription
    publish(message: Message): void
}

export interface Bus {
    channels: Channel[]
    createChannel(channelName: string): Channel
    getChannel(channelName: string): Channel
    connectToBroker(config: StompConfig): void;
    mapChannelToBrokerDestination(destination: string, channel: string): void
    getClient(): Client | undefined
}

export interface CommandResponse<T = any> {
    channel: string;
    payload: T;
}


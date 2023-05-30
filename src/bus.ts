import {Client, StompConfig} from "@stomp/stompjs";

export type BusCallback<T = any> = (message: Message<T>) => void

export interface Subscription {
    unsubscribe(): void
}

export interface Subscriber {
    name: string
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


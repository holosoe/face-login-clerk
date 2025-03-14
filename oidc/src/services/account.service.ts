import { accounts } from '../db/memory.js'

export const get = async (key: string) => accounts.get(key)
export const set = async (key: string, value: any) => accounts.set(key, value)

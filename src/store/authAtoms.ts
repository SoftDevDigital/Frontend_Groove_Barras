"use client";
import { atom } from "jotai";
import { getToken, getUser, User } from "@/lib/auth";

export const tokenAtom = atom<string | null>(getToken());
export const userAtom  = atom<User | null>(getUser());

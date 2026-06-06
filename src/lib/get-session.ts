import { cache } from "react"
import { auth } from "@/lib/auth"

/** One session resolution per RSC request (layouts + pages). */
export const getSession = cache(() => auth())

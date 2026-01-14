import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: 'https://patient-kodiak-28616.upstash.io',
    token: 'AW_IAAIncDEzMWQwYjY3MWQxNDQ0MDFlODlkNjA3NGQ2MjFlMWY5NnAxMjg2MTY',
})

try {
    console.log("Setting 'foo' to 'bar'...");
    await redis.set("foo", "bar");
    console.log("Success: Set 'foo' to 'bar'");

    console.log("Getting value for 'foo'...");
    const value = await redis.get("foo");
    console.log("Success: Retrieved 'foo' =", value);
} catch (error) {
    console.error("Error connecting to Upstash Redis:", error);
}

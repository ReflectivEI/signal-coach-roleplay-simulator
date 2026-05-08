export default {
  async fetch(request, env, ctx) {
    // Write a key-value pair
    await env.__STATIC_CONTENT.put('KEY', 'VALUE');
    // Read a key-value pair
    const value = await env.__STATIC_CONTENT.get('KEY');
    // List all key-value pairs
    const allKeys = await env.__STATIC_CONTENT.list();
    // Delete a key-value pair
    await env.__STATIC_CONTENT.delete('KEY');
    // Return a Workers response
    return new Response(
      JSON.stringify({
        value: value,
        allKeys: allKeys,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
};

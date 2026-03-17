import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "No authorization header" }), {
        status: 401,
        headers: jsonHeaders,
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // Verificar JWT del llamante
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      })
    }

    // Verificar que el llamante sea admin
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!callerProfile?.is_admin) {
      return new Response(JSON.stringify({ ok: false, error: "Forbidden: admin only" }), {
        status: 403,
        headers: jsonHeaders,
      })
    }

    const { action, payload = {} } = await req.json()

    switch (action) {
      case "list_users": {
        const { data, error } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: true })
        if (error) throw error
        return new Response(JSON.stringify({ ok: true, users: data }), { headers: jsonHeaders })
      }

      case "delete_user": {
        const { user_id } = payload
        if (!user_id) throw new Error("user_id requerido")

        // Borrar de auth (el trigger/cascade debería borrar el profile, pero lo hacemos explícito)
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id)
        if (deleteAuthError) throw deleteAuthError

        await supabaseAdmin.from("profiles").delete().eq("id", user_id)

        return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders })
      }

      case "set_password": {
        const { user_id, new_password } = payload
        if (!user_id || !new_password) throw new Error("user_id y new_password requeridos")
        if (new_password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres")

        const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          password: new_password,
        })
        if (error) throw error

        return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders })
      }

      default:
        return new Response(
          JSON.stringify({ ok: false, error: `Acción desconocida: ${action}` }),
          { status: 400, headers: jsonHeaders },
        )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: jsonHeaders,
    })
  }
})

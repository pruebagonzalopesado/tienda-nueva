const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://tvzvuotqdtwmssxfnyqc.supabase.co";
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2enZ1b3RxZHR3bXNzeGZueXFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzc2NzgyMSwiZXhwIjozMzI1MTAwNDYyMX0.vR8fFJQM8v7jWKQ9l4WZ6Q0Z0y2Z0y2Z0y2Z0y2Z0y0";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function addReferencias() {
  try {
    // Obtener todos los productos
    const { data: productos, error: getError } = await supabase
      .from("products")
      .select("*");

    if (getError) {
      console.error("Error al obtener productos:", getError);
      return;
    }

    console.log(`Encontrados ${productos.length} productos`);

    // Actualizar cada producto con una referencia
    for (let i = 0; i < productos.length; i++) {
      const producto = productos[i];
      const referencia = `REF-${String(i + 1).padStart(4, "0")}`;

      const { error: updateError } = await supabase
        .from("products")
        .update({ referencia })
        .eq("id", producto.id);

      if (updateError) {
        console.error(
          `Error al actualizar producto ${producto.id}:`,
          updateError
        );
      } else {
        console.log(
          `✓ Producto ${producto.nombre} -> ${referencia}`
        );
      }
    }

    console.log("\n✅ Migración completada");
  } catch (error) {
    console.error("Error:", error);
  }
}

addReferencias();

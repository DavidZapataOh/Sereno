CREATE TABLE "corridas" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"iniciado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"terminado_en" timestamp with time zone,
	"mensajes_vistos" integer DEFAULT 0 NOT NULL,
	"movimientos_nuevos" integer DEFAULT 0 NOT NULL,
	"desconocidos" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "cursores" (
	"id" text PRIMARY KEY NOT NULL,
	"valor" text NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mensajes" (
	"id" text PRIMARY KEY NOT NULL,
	"origen" text NOT NULL,
	"remitente" text NOT NULL,
	"asunto" text NOT NULL,
	"recibido_en" timestamp with time zone NOT NULL,
	"texto" text NOT NULL,
	"html" text,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"motivo" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimientos" (
	"id" text PRIMARY KEY NOT NULL,
	"secuencia" bigserial NOT NULL,
	"mensaje_id" text NOT NULL,
	"fuente" text NOT NULL,
	"fecha" text NOT NULL,
	"descripcion" text NOT NULL,
	"monto" text NOT NULL,
	"moneda" text NOT NULL,
	"tipo" text NOT NULL,
	"referencia" text,
	"entregado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_mensaje_id_mensajes_id_fk" FOREIGN KEY ("mensaje_id") REFERENCES "public"."mensajes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_corridas_inicio" ON "corridas" USING btree ("iniciado_en");--> statement-breakpoint
CREATE INDEX "idx_mensajes_estado" ON "mensajes" USING btree ("estado","recibido_en");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_movimientos_secuencia" ON "movimientos" USING btree ("secuencia");--> statement-breakpoint
CREATE INDEX "idx_movimientos_mensaje" ON "movimientos" USING btree ("mensaje_id");
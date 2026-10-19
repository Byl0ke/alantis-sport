-- ALANTIS SPORT · MySQL 8.0+/8.4 · utf8mb4, InnoDB, UTC
-- Never commit customer data, credentials or database exports to GitHub.
CREATE TABLE IF NOT EXISTS customers (
  customer_id VARCHAR(64) PRIMARY KEY,
  email_encrypted VARBINARY(1024) NULL,
  first_name_encrypted VARBINARY(1024) NULL,
  last_name_encrypted VARBINARY(1024) NULL,
  created_at VARCHAR(45) NULL,
  updated_at VARCHAR(45) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  product_id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(300) NOT NULL,
  vendor VARCHAR(150) NULL,
  product_type VARCHAR(150) NULL,
  status VARCHAR(24) NULL,
  updated_at VARCHAR(45) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_variants (
  variant_id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) NOT NULL,
  title VARCHAR(300) NULL,
  sku VARCHAR(120) NULL,
  price DECIMAL(14,2) NOT NULL DEFAULT 0,
  inventory_item_id VARCHAR(64) NULL,
  CONSTRAINT fk_variant_product FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory (
  inventory_item_id VARCHAR(64) NOT NULL,
  location_id VARCHAR(64) NOT NULL,
  available INT NULL,
  updated_at VARCHAR(45) NULL,
  PRIMARY KEY(inventory_item_id,location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  order_id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  customer_id VARCHAR(64) NULL,
  email_encrypted VARBINARY(1024) NULL,
  total DECIMAL(14,2) NOT NULL,
  currency VARCHAR(8) NOT NULL,
  financial_status VARCHAR(48) NULL,
  fulfillment_status VARCHAR(48) NULL,
  created_at VARCHAR(45) NULL,
  updated_at VARCHAR(45) NULL,
  cancelled_at VARCHAR(45) NULL,
  last_event VARCHAR(80) NOT NULL,
  KEY idx_orders_created_at(created_at),
  KEY idx_orders_customer_id(customer_id),
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  order_id VARCHAR(64) NOT NULL,
  line_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NULL,
  variant_id VARCHAR(64) NULL,
  title VARCHAR(300) NOT NULL,
  sku VARCHAR(120) NULL,
  quantity INT NOT NULL DEFAULT 0,
  price DECIMAL(14,2) NULL,
  PRIMARY KEY(order_id,line_id),
  CONSTRAINT fk_orderitem_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Snapshot, not an authoritative ledger of captured payments or Stripe charges.
CREATE TABLE IF NOT EXISTS sales (
  order_id VARCHAR(64) PRIMARY KEY,
  gross_total DECIMAL(14,2) NOT NULL,
  currency VARCHAR(8) NOT NULL,
  payment_status VARCHAR(48) NULL,
  updated_at VARCHAR(45) NULL,
  CONSTRAINT fk_sales_order FOREIGN KEY(order_id) REFERENCES orders(order_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_receipts (
  webhook_id VARCHAR(128) PRIMARY KEY,
  topic VARCHAR(100) NOT NULL,
  received_at VARCHAR(45) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  created_at VARCHAR(45) NOT NULL,
  actor VARCHAR(70) NOT NULL,
  action VARCHAR(100) NOT NULL,
  target VARCHAR(250) NULL,
  event_type VARCHAR(50) NOT NULL,
  KEY idx_audit_created_at(created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
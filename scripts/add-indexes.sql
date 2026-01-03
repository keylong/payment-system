-- 添加数据库索引（如果不存在）
-- demo_orders 表索引
CREATE INDEX IF NOT EXISTS demo_orders_status_idx ON demo_orders USING btree (status);
CREATE INDEX IF NOT EXISTS demo_orders_merchant_id_idx ON demo_orders USING btree (merchant_id);
CREATE INDEX IF NOT EXISTS demo_orders_payment_id_idx ON demo_orders USING btree (payment_id);
CREATE INDEX IF NOT EXISTS demo_orders_expires_at_idx ON demo_orders USING btree (expires_at);

-- merchants 表索引
CREATE INDEX IF NOT EXISTS merchants_is_active_idx ON merchants USING btree (is_active);

-- payments 表索引
CREATE INDEX IF NOT EXISTS payments_callback_status_idx ON payments USING btree (callback_status);
CREATE INDEX IF NOT EXISTS payments_merchant_id_idx ON payments USING btree (merchant_id);
CREATE INDEX IF NOT EXISTS payments_timestamp_idx ON payments USING btree (timestamp);
CREATE INDEX IF NOT EXISTS payments_status_callback_idx ON payments USING btree (status, callback_status);

-- pending_orders 表索引
CREATE INDEX IF NOT EXISTS pending_orders_status_idx ON pending_orders USING btree (status);
CREATE INDEX IF NOT EXISTS pending_orders_expires_at_idx ON pending_orders USING btree (expires_at);
CREATE INDEX IF NOT EXISTS pending_orders_amount_method_idx ON pending_orders USING btree (amount, payment_method);

-- qr_codes 表索引
CREATE INDEX IF NOT EXISTS qr_codes_type_active_idx ON qr_codes USING btree (type, is_active);

-- unmatched_payments 表索引
CREATE INDEX IF NOT EXISTS unmatched_payments_is_processed_idx ON unmatched_payments USING btree (is_processed);
CREATE INDEX IF NOT EXISTS unmatched_payments_amount_method_idx ON unmatched_payments USING btree (amount, payment_method);

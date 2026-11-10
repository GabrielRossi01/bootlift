package dev.rossi.billing.invoice;

import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

@Component
public class InvoiceSigner {

    private final JsonMapper jsonMapper;
    private final byte[] secret = "fixture-secret".getBytes(StandardCharsets.UTF_8);

    public InvoiceSigner(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    public String sign(Invoice invoice) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret, "HmacSHA256"));
        byte[] payload = jsonMapper.writeValueAsBytes(invoice);
        return HexFormat.of().formatHex(mac.doFinal(payload));
    }
}

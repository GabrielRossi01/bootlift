package dev.rossi.billing.invoice;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class InvoiceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private InvoiceSigner signer;

    @Test
    void signsInvoice() throws Exception {
        given(signer.sign(any())).willReturn("abc123");

        mockMvc.perform(post("/invoices/sign")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"customer_id\":\"c1\",\"amount\":10}"))
                .andExpect(status().isOk());
    }
}
